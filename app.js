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
    ratingGiven: [String]
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

// HTTP Request
app.get('/', async (req, res) => {
    try {
        // return sorted food based on rating
        let foods = await Food.find({});
        foods.sort((a, b) => b.currentRating - a.currentRating);

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
        res.render('categories', { myacc: myacc, redir: redir });
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
                var myacc, redir, ratingCheck;
                if (req.isAuthenticated()) {
                    let rated = false;
                    for (let j = 0; j < req.user.ratingGiven.length; j++){
                        if (req.user.ratingGiven[j] == foods[i].name){
                            rated = true;
                            break;
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
                    ratingCheck: ratingCheck
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
        const response = {username: req.user.username, ratingNumber: req.body.rate, review: req.body.review}
        doc.rating.push(response);
        const ratingChange = ((doc.currentRating * (doc.rating.length - 1)) + req.body.rate * 1)/(doc.rating.length);
        doc.currentRating = ratingChange;
        docUser.ratingGiven.push(req.body.foodName);
        doc.save();
        docUser.save()
        res.redirect('/foods/' + req.params.foodName);
    }else{
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
        // res.status(200).json({error: false, foods : foods});
        res.render("toprated", { foods: foods, pageTitle: "", month: "Agustus", myacc: myacc, redir: redir });
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
            res.render('login')
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
            render('/login');
        } else {
            passport.authenticate("local")(req, res, function () {
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