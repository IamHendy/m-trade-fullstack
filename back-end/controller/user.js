const express = require("express");
const router = express.Router();
const path = require("path");
const { upload } = require("../multer");
const fs = require("fs");
const User = require("../model/user");
const jwt = require("jsonwebtoken");
const sendMail = require("../utils/sendMail");
const ErrorHandler = require("../utils/ErrorHandler");
const sendToken = require("../utils/jwtToken");
const catchAsyncErrors = require("../middleware/CatchAsyncErrors");
const {isAuthenticated, isAdmin } =require("../middleware/auth");

// create activation token function
const createActivationToken = (user) => {
    return jwt.sign(user, process.env.ACTIVATION_SECRET, {
        expiresIn: "5m",
    });
};

router.post("/create-user", upload.single("file"), async (req, res, next) => {
    const { name, email, password } = req.body;
    const userEmail = await User.findOne({ email });

    if (userEmail) {
        const filename = req.file.filename;
        const filePath = path.join(__dirname, `../uploads/${filename}`);

        fs.unlink(filePath, (err) => {
            if (err) {
                console.log(err);
                res.status(500).json({ message: "Error deleting file" });
            } 
        });
        return next(new ErrorHandler("User already exists", 400));
    }

    const filename = req.file.filename;
    const fileUrl = path.join(filename);

    const user = {
        name: name,
        email: email,
        password: password,
        avatar: fileUrl,
    };

    try {
        const newUser = await User.create(user);

        const activationToken = createActivationToken(user);
        const activationUrl = `http://localhost:3000/activation/${activationToken}`;

        await sendMail({
            email: user.email,
            subject: "Activate your account",
            message: `Hello ${user.name}, please click on the link to activate your account: ${activationUrl}`,
        });

        res.status(201).json({
            success: true,
            message: `Please check your email: ${user.email} to activate your account`,
            newUser,
        });
    } catch (error) {
        return next(new ErrorHandler(error.message, 500));
    }
});

//activate user
router.post(
    "/activation",
    catchAsyncErrors(async (req, res, next) =>{
        try {
            const { activation_token } = req.body;

            const newUser = jwt.verify(
                activation_token,
                process.env.ACTIVATION_SECRET
            );

            if (!newUser) {
                return next(new ErrorHandler("Invalid token", 400));
            }
            const { name, email, password, avatar } = newUser;

            let user = await User.findOne({ email  });

            if (user) {
                return next(new ErrorHandler("User already exists", 400));
            }
            user = await User.create({
                name,
                email,
                avatar,
                password
            });

            sendToken(user, 201, res);
        } catch (error) {
            return next (new ErrorHandler(error.message, 500));
        }
    })
);

//login user
router.post(
    "/login-user",
    catchAsyncErrors(async (req, res, next) => {
        try {
            const { email,  password } = req.body;

            if (!email || !password ) {
                return next(new ErrorHandler("Please provide information for the fields!", 400));
            }

            const user = await User.findOne({ email }).select("+password");

            if (!user) {
                return next(new ErrorHandler("User does not exist!", 400));
            }
            const isPasswordValid = await user.comparePassword(password);

            if (!isPasswordValid) {
                return next(
                    new ErrorHandler("Please provide the correct information", 400));
                }
                sendToken(user, 201, res);
            }catch (error) {
                return next(new ErrorHandler(error.message, 500));
            }

        
        
    })
);

//load user
router.get(
    "/getuser",
    isAuthenticated,
    catchAsyncErrors(async (req, res, next) => {
      try {
        const user = await User.findById(req.user.id);
  
        if (!user) {
          return next(new ErrorHandler("User doesn't exists", 400));
        }
  
        res.status(200).json({
          success: true,
          user,
        });
      } catch (error) {
        return next(new ErrorHandler(error.message, 500));
      }
    })
  );

module.exports = router;
