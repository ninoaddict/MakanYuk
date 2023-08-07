const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const ejs = require("ejs");
var _ = require('lodash');
require('dotenv').config();
const session = require('express-session');
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose');
// const foodsData = require("./config/foods.json")

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
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
}
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
    price : Number,
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

app.use(function(req,res,next){
    res.locals.currentUser = req.user;
    next();
})

// HTTP Request
app.get('/', async(req, res) =>{
    try{
        // return sorted food based on rating
        let foods = await Food.find({});
        foods.sort((a, b) => b.currentRating - a.currentRating);

        var myacc;
        var redir;
        if (req.isAuthenticated()){
            myacc = "My Account";
            redir = "/myaccount"
        }else{
            myacc = "Login";
            redir= "/login";
        }
        const response = {
            myacc : myacc,
            redir : redir,
            error: false,
            foods : foods
        };
        res.render("home", response);
        //res.status(200).json(response);
    } catch(err){
        console.log(err);
        res.status(500).json({error: true, message: "Internal Server Error Babi!"});
    }
});

app.get('/categories', async(req, res) => {
    try{
        var myacc;
        var redir;
        if (req.isAuthenticated()){
            myacc = "My Account";
            redir = "/myaccount"
        }else{
            myacc = "Login";
            redir= "/login";
        }
        res.render('categories', {myacc: myacc, redir: redir});
    }catch(err){
        res.status(500).json({error: true, message: "Internal Server Error"});
    }
});

app.get('/categorysearch', async(req, res) => {
    try{
        var myacc;
        var redir;
        if (req.isAuthenticated()){
            myacc = "My Account";
            redir = "/myaccount"
        }else{
            myacc = "Login";
            redir= "/login";
        }
        const foods = await Food.find({});
        const response = {
            myacc: myacc,
            redir: redir,
            error: false,
            foods
        }
        res.status(200).json(response)
    }catch(err){
        res.status(500).json({error: true, message: "Internal Server Error"});
    }
});

app.get('/foods/:foodName', async(req, res)=>{
    try{
        const foods = await Food.find({});
        let found = false;
        for (let i = 0; i < foods.length; i++){
            if (_.lowerCase(foods[i].name) === _.lowerCase(req.params.foodName)){
                found = true;
                res.status(200).json({error: false, food: foods[i]});
            }
        }
        if (!found){
            res.status(400);
        }
    }catch(err){
        res.status(500).json({error: true, message: "Internal Server Error"});
    }
});

app.get('/toprated', async(req, res)=>{
    try{
        var myacc;
        var redir;
        if (req.isAuthenticated()){
            myacc = "My Account";
            redir = "/myaccount"
        }else{
            myacc = "Login";
            redir= "/login";
        }
        let foods = await Food.find({});
        foods.sort((a, b) => b.currentRating - a.currentRating);
        // res.status(200).json({error: false, foods : foods});
        res.render("toprated", {foods : foods, pageTitle : "", month: "Agustus", myacc: myacc, redir : redir});
    }catch{
        res.status(500).json({error: true, message: "Internal Server Error"});   
    }
});

app.get('/about', (req, res)=>{
    try{
        var myacc;
        var redir;
        if (req.isAuthenticated()){
            myacc = "My Account";
            redir = "/myaccount"
        }else{
            myacc = "Login";
            redir= "/login";
        }
        res.render("about", {myacc : myacc, redir: redir});
    }catch{
        res.status(500).json({error: true});
    }
});

app.get('/login', (req, res)=>{
    try{
        if (req.isAuthenticated()){
            req.session.save(() =>
            {
                return res.redirect('/');
            });
        }else{
            res.render('login')
        }
    }
    catch{
        res.status(500).json({error: true});
    }
});

app.get('/register', (req, res)=>{
    try{
        if (req.isAuthenticated()){
            req.session.save(() =>
            {
                return res.redirect('/');
            });
        }else{
            res.render('register')
        }
    }
    catch{
        res.status(500).json({error: true});
    }
}); 

app.post('/register', (req, res) => {
    if (req.body.password == req.body.confirmpassword){
        User.register({username: req.body.username, email: req.body.email, favoriteCategories: [], favoriteFood: [], ratingGiven: []}, req.body.password, (err, user)=>{
            if (err){
                console.log(err);
                req.session.save(() =>
                {
                    return res.redirect('/register');
                });
            }else{
                passport.authenticate("local")(req, res, function(){
                    req.session.save(() =>
                    {
                        return res.redirect('/');
                    });
                })
            }
        });
    }else{
        req.session.save(() =>
        {
            return res.redirect('/register');
        });
    }
});

app.post('/login', (req, res)=>{
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    req.login(user, function(err){
        if (err){
            render('/login');
        }else{
            passport.authenticate("local")(req, res, function(){
                req.session.save(() =>
                {
                    return res.redirect('/');
                });
            });
        }
    });
});

app.get('/eatlist', (req, res)=>{
    try{
        if (req.isAuthenticated()){
            let myacc = "My Account";
            let redir = "/myaccount";
            res.render("eatlist", {myacc: myacc, redir: redir});
        }else{
            req.session.save(() =>
            {
                return res.redirect('/login');
            });
        }
    }
    catch{
        res.status(500).json({error: true});
    }
});

connectDB().then(() => {
    app.listen(port, () => {
        console.log("listening for requests");
    })
})