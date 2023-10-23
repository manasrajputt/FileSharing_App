var express = require('express');
var router = express.Router();
const passport = require('passport');
const userModel = require('./users');
const docsModel = require('./file')
const multer = require('multer')
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('../nodemailer');

const localStrategy = require("passport-local");
passport.use(new localStrategy(userModel.authenticate()));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/uploads')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueSuffix)
  }
})

const upload = multer({ storage: storage })

/* GET home page. */
router.get('/', function (req, res, next) {
  res.redirect('/login')
});

router.post('/upload', upload.single('file'), isLoggedIn, async function (req, res, next) {
  const filedata = {
    path: req.file.path,
    originalName: req.file.originalname,
  }

  const file = await docsModel.create(filedata)
  userModel.findOne({ username: req.session.passport.user })
    .then(function (foundUser) {
      foundUser.documents.push(file._id);
      foundUser.save()
        .then(function () {
          res.redirect("back");
        })
    })
})

router.get('/login', function (req, res, next) {
  res.render("login");
});

router.get('/register', function (req, res, next) {
  res.render("register");
});

router.get('/forgot', function (req, res, next) {
  res.render('forgot');
})

router.post('/forgot', async function (req, res, next) {
  var user = await userModel.findOne({ email: req.body.email });
  if (!user) {
    res.send("we've sent a mail, if email exists.");
  }
  else {
    crypto.randomBytes(80, async function (err, buff) {
      // console.log(buff);
      let key = buff.toString("hex");
      // console.log(key);
      user.key = key;
      await user.save();
      await nodemailer(req.body.email, user._id, key)
    })
  }
})

router.get('/forgot/:userid/:key', async function (req, res, next) {
  let user = await userModel.findById({ _id: req.params.userid })
  if (user.key === req.params.key) {
    res.render("reset", { user })
  }
  else {
    res.send("link expire");
  }
})

router.post("/reset/:userid", async function (req, res, next) {
  let user = await userModel.findOne({ _id: req.params.userid })
  if (req.body.password === req.body.confirmpassword) {
    user.setPassword(req.body.password, async function () {
      user.key = "";
      await user.save();
      req.logIn(user, function () {
        res.redirect("/profile");
      })
    })
  }
  else{
    res.send("password and comfirm password not match");
  }
})

router.get('/profile', isLoggedIn, function (req, res, next) {
  userModel.findOne({ username: req.session.passport.user })
    .populate("documents")
    .then(function (foundUser) {
      // console.log(foundUser)
      res.render("profile", { foundUser });
    })
});

router.get('/delete/:docsid', isLoggedIn, function (req, res, next) {
  userModel.findOne({ username: req.session.passport.user })
    .then(function (foundUser) {
      docsModel.findOne({ _id: req.params.docsid })
        .then(function (data) {
          fs.unlinkSync(`./${data.path}`);
        })
      docsModel.findOneAndDelete({ _id: req.params.docsid })
        .then(function () {
          foundUser.documents.splice(foundUser.documents.indexOf(req.params.docsid), 1);
          foundUser.save()
            .then(function () {
              res.redirect("back");
            })
        })
    })
})

router.get('/download/:docsid', function (req, res, next) {
  docsModel.findOne({ _id: req.params.docsid })
    .then(function (data) {
      data.downloadCount++;
      data.save()
        .then(function (updatedata) {
          // console.log(updateddata)
          res.download(updatedata.path, updatedata.originalName);
        })
    })
});

router.post('/register', function (req, res, next) {
  var newUser = new userModel({
    email: req.body.email,
    username: req.body.username,
    profession: req.body.profession,
  })
  userModel.register(newUser, req.body.password)
    .then(function (usercreated) {
      passport.authenticate('local')(req, res, function () {
        res.redirect('/profile');
      })
    })
    .catch(function (e) {
      res.send(e);
    })
})

router.post('/login', passport.authenticate("local", {
  successRedirect: "/profile",
  failureRedirect: "/login"
}), function (req, res, next) {
});

router.get('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/login');
  })
})

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  else {
    res.redirect('/login')
  }
}

module.exports = router;
