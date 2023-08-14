const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const ejs = require("ejs");
var _ = require('lodash');
require('dotenv').config();
const session = require('express-session');
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose');
const MongoStore = require("connect-mongo");
const flush =  require('connect-flash');
// const foodsData = require("./config/foods.json")

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.DB_URL
    }),
}));

app.use(passport.initialize());
app.use(passport.session());

// connect to DB
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.DB_URL);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
};
// mongoose.set("useCreateIndex", true);
// DB model
const foodSchema = new mongoose.Schema({
    name: String,
    rating: [{
        username: String,
        ratingNumber: Number,
        review: String
    }],
    currentRating: Number,
    categories: [String],
    price: Number,
    kalori: Number,
    lemak: Number,
    karbohidrat: Number,
    protein: Number
});

const userSchema = new mongoose.Schema({
    email: String,
    username: String,
    password: String,
    favoriteCategories: [String],
    favoriteFood: [String],
    ratingGiven: [{
        foodName: String,
        ratingNumber: Number,
        review: String
    }]
});

userSchema.plugin(passportLocalMongoose);

// establish db collection
const Food = mongoose.model("Food", foodSchema);
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function (req, res, next) {
    res.locals.currentUser = req.user;
    next();
});


app.use(flush());

// HTTP Request
app.get('/', async (req, res) => {
    try {
        // return sorted food based on rating
        let foods = await Food.find({});
        foods.sort((a, b) => b.currentRating - a.currentRating);
        foods = foods.slice(0, 6);
        var myacc;
        var redir;
        if (req.isAuthenticated()) {
            myacc = "My Account";
            redir = "/myaccount"
        } else {
            myacc = "Login";
            redir = "/login";
        }
        const response = {
            myacc: myacc,
            redir: redir,
            error: false,
            foods: foods
        };
        res.render("home", response);
        //res.status(200).json(response);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: true, message: "Internal Server Error Babi!" });
    }
});

app.post('/', (req, res)=>{
    res.redirect('/foods');
});

app.get('/categories', async (req, res) => {
    try {
        var myacc;
        var redir;
        if (req.isAuthenticated()) {
            myacc = "My Account";
            redir = "/myaccount"
        } else {
            myacc = "Login";
            redir = "/login";
        }
        res.render('categories', { myacc: myacc, redir: redir, pageTitle: "Categories"});
    } catch (err) {
        res.status(500).json({ error: true, message: "Internal Server Error" });
    }
});

app.get('/foods', async (req, res) => {
    try {
        var myacc;
        var redir;
        if (req.isAuthenticated()) {
            myacc = "My Account";
            redir = "/myaccount"
        } else {
            myacc = "Login";
            redir = "/login";
        }
        const foods = await Food.find({});
        const response = {
            foods: foods,
            myacc: myacc,
            redir: redir,
            error: false,
            pageTitle: "Foods"
        }
        // res.status(200).json(response)
        res.render("categorysearch", response)
    } catch (err) {
        res.status(500).json({ error: true, message: "Internal Server Error" });
    }
});

app.get('/foods/:foodName', async (req, res) => {
    try {
        const foods = await Food.find({});
        let found = false;
        for (let i = 0; i < foods.length; i++) {
            if (_.lowerCase(foods[i].name) === _.lowerCase(req.params.foodName)) {
                found = true;
                var myacc, redir, ratingCheck, reviewContent = "", reviewStar = 0, favClass = "";
                if (req.isAuthenticated()) {
                    let rated = false;
                    for (let j = 0; j < req.user.ratingGiven.length; j++){
                        if (req.user.ratingGiven[j].foodName == foods[i].name){
                            rated = true;
                            reviewContent = req.user.ratingGiven[j].review;
                            reviewStar = req.user.ratingGiven[j].ratingNumber;
                            break;
                        }
                    }
                    for (let k = 0; k < req.user.favoriteFood.length; k++){
                        if (foods[i].name == req.user.favoriteFood[k]){
                            favClass = "active";
                        }
                    }
                    if (rated){
                        ratingCheck = "Rated";
                    }else{
                        ratingCheck = "Rate";
                    }
                    myacc = "My Account";
                    redir = "/myaccount"
                } else {
                    myacc = "Login";
                    redir = "/login";
                    ratingCheck = "Rate";
                }
                const response = {
                    food: foods[i],
                    myacc: myacc,
                    redir: redir,
                    ratingCheck: ratingCheck,
                    reviewContent: reviewContent,
                    reviewStar: reviewStar,
                    pageTitle: req.params.foodName,
                    favClass: favClass
                }
                res.render('food', response);
            }
        }
        if (!found) {
            res.status(400);
        }
    } catch (err) {
        res.status(500).json({ error: true, message: "Internal Server Error" });
    }
});

app.post('/foods/:foodName', async (req, res)=>{
    if (req.isAuthenticated()){
        const doc = await Food.findOne({name: req.body.foodName});
        const docUser = await User.findOne({_id: req.user._id});
        doc.rating.push({username: req.user.username, ratingNumber: req.body.rate, review: req.body.review});
        const ratingChange = ((doc.currentRating * (doc.rating.length - 1)) + req.body.rate * 1)/(doc.rating.length);
        doc.currentRating = ratingChange;
        docUser.ratingGiven.push({foodName: req.body.foodName, review: req.body.review, ratingNumber: req.body.rate});
        doc.save();
        docUser.save()
        res.redirect('/foods/' + req.params.foodName);
    }else{
        req.flash('message', 'Please Login to Your Account!');
        res.redirect('/login');
    }
});

app.get('/myaccount', (req, res)=>{
    if (req.isAuthenticated()){
        res.render("dashboard");
    }else{
        res.redirect('/');
    }
});

app.get('/toprated', async (req, res) => {
    try {
        var myacc;
        var redir;
        if (req.isAuthenticated()) {
            myacc = "My Account";
            redir = "/myaccount"
        } else {
            myacc = "Login";
            redir = "/login";
        }
        let foods = await Food.find({});
        foods.sort((a, b) => b.currentRating - a.currentRating);
        foods = foods.slice(0, 6);
        // res.status(200).json({error: false, foods : foods});
        res.render("toprated", { foods: foods, pageTitle: "", month: "Agustus", myacc: myacc, redir: redir, pageTitle: "Top Rated"});
    } catch {
        res.status(500).json({ error: true, message: "Internal Server Error" });
    }
});

app.get('/about', (req, res) => {
    try {
        var myacc;
        var redir;
        if (req.isAuthenticated()) {
            myacc = "My Account";
            redir = "/myaccount"
        } else {
            myacc = "Login";
            redir = "/login";
        }
        res.render("about", { myacc: myacc, redir: redir });
    } catch {
        res.status(500).json({ error: true });
    }
});

app.get('/login', (req, res) => {
    try {
        if (req.isAuthenticated()) {
            res.redirect('/');
        } else {
            res.render('login', {message : req.flash('message')});
        }
    }
    catch {
        res.status(500).json({ error: true });
    }
});

app.get('/register', (req, res) => {
    try {
        if (req.isAuthenticated()) {
            res.redirect('/');
        } else {
            res.render('register')
        }
    }
    catch {
        res.status(500).json({ error: true });
    }
});

app.post('/register', (req, res) => {
    if (req.body.password == req.body.confirmpassword) {
        User.register({ username: req.body.username, email: req.body.email, favoriteCategories: [], favoriteFood: [], ratingGiven: [] }, req.body.password, (err, user) => {
            if (err) {
                console.log(err);
                req.session.save(() => {
                    return res.redirect('/register');
                });
            } else {
                passport.authenticate("local")(req, res, function () {
                    res.redirect('/');
                })
            }
        });
    } else {
        res.redirect('/register');
    }
});

app.post('/login', (req, res) => {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    req.login(user, function (err) {
        if (err) {
            res.redir('/login');
        } else {
            passport.authenticate("local", (err, user, next) => {
                if (err){
                    return next(err);
                }
                if (!err){
                    req.flash('message', 'User Not Found! Please Try Again')
                    return res.redirect('/login');
                }
            })
            (req, res, function () {
                res.redirect('/');
            });
        }
    });
});

app.get('/eatlist', (req, res) => {
    try {
        if (req.isAuthenticated()) {
            let myacc = "My Account";
            let redir = "/myaccount";
            res.render("eatlist", { myacc: myacc, redir: redir });
        } else {
            req.flash('message', 'Please Login to Your Account!');
            res.redirect('/login');
        }
    }
    catch {
        res.status(500).json({ error: true });
    }
});

app.get('/logout', (req, res, next) => {
    req.logout((err)=>{
        if (err){
            return next(err);
        }
        res.redirect('/');
    });
});

app.post('/addfav', async (req, res)=>{
    if (req.isAuthenticated()){
        let addOrNot = req.body.isAdded;
        let foodName = req.body.foodName;
        const docUser = await User.findOne({_id: req.user._id});
        if (addOrNot){
            docUser.favoriteFood.push(foodName);
        }
        else{
            let tempArr = docUser.favoriteFood;
            docUser.favoriteFood = tempArr.filter((fname)=>{
                return fname != foodName;
            });
        }
        docUser.save();
    }
});

app.post('/foods/:foodName/savechanges', async (req, res)=>{
    const docFood = await Food.findOne({name: req.body.foodName});
    const docUser = await User.findOne({_id: req.user._id});
    var ratingFoodIndex = 0;
    var ratingUserIndex = 0;
    for (var i = 0; i < docFood.rating.length; i++){
        if (docFood.rating[i].username == req.user.username){
            ratingFoodIndex = i;
            break;
        }
    }
    for (var i = 0; i < docUser.ratingGiven.length; i++){
        if (docUser.ratingGiven[i].foodName == req.body.foodName){
            ratingUserIndex = i;
            break;
        }
    }
    const oldRating = docFood.rating[ratingFoodIndex].ratingNumber;
    const newRating = req.body.rated;
    // change food database
    docFood.rating[ratingFoodIndex].ratingNumber = newRating;
    docFood.rating[ratingFoodIndex].review = req.body.review;
    docFood.currentRating = (docFood.currentRating * docFood.rating.length - oldRating * 1 + newRating * 1)/docFood.rating.length;

    // change user database
    docUser.ratingGiven[ratingUserIndex].ratingNumber = newRating;
    docUser.ratingGiven[ratingUserIndex].review = req.body.review;

    // save all data
    docUser.save();
    docFood.save();
    res.redirect('/foods/' + req.params.foodName);
});

// const insertFoods = async () => {
//     try{
//         const docs = await Food.insertMany(foodsData);
//         return Promise.resolve(docs);
//     }catch{
//         return Promise.reject(err);
//     }
// };

// insertFoods()
//     .then((docs) => console.log(docs))
//     .catch((err)=> console.log(err));

connectDB().then(() => {
    app.listen(port, () => {
        console.log("listening for requests");
    });
});