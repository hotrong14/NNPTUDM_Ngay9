var express = require("express");
var router = express.Router();
let messageModel = require("../schemas/messages");
let { CheckLogin } = require('../utils/authHandler');
const multer = require('multer');
const path = require('path');

// Cấu hình multer để lưu file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// 1. GET "/:userID" - lấy toàn bộ message giữa user hiện tại và userID
router.get("/:userID", CheckLogin, async function (req, res, next) {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userID;

    const messages = await messageModel.find({
      $or: [
        { from: currentUserId, to: targetUserId },
        { from: targetUserId, to: currentUserId }
      ]
    }).sort({ createdAt: 1 });

    res.send(messages);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// 2. POST "/" - gửi message
router.post("/", CheckLogin, upload.single('file'), async function (req, res, next) {
  try {
    const from = req.user._id;
    const { to, text } = req.body;
    let messageContent = {};

    if (req.file) {
      messageContent = {
        type: 'file',
        text: req.file.path // hoặc req.file.filename tùy yêu cầu
      };
    } else {
      messageContent = {
        type: 'text',
        text: text
      };
    }

    const newMessage = new messageModel({
      from,
      to,
      messageContent
    });

    const savedMessage = await newMessage.save();
    res.send(savedMessage);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// 3. GET "/" - lấy message cuối cùng của mỗi cuộc hội thoại
router.get("/", CheckLogin, async function (req, res, next) {
  try {
    const currentUserId = req.user._id;

    const lastMessages = await messageModel.aggregate([
      {
        $match: {
          $or: [{ from: currentUserId }, { to: currentUserId }]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$from", currentUserId] },
              "$to",
              "$from"
            ]
          },
          lastMessage: { $first: "$$ROOT" }
        }
      },
      {
        $replaceRoot: { newRoot: "$lastMessage" }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    res.send(lastMessages);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

module.exports = router;
