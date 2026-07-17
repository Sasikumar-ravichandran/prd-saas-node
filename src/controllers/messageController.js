const Message = require('../models/Message');
const Chat = require('../models/Chat');

// @desc    Send a new message
// @route   POST /api/messages
exports.sendMessage = async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    return res.status(400).json({ message: "Invalid data passed into request" });
  }

  const newMessage = {
    sender: req.user._id,
    content: content,
    chatId: chatId,
    readBy: [req.user._id] // Sender automatically read it
  };

  try {
    // 1. Save the message
    let message = await Message.create(newMessage);

    // 2. Populate sender details so frontend can show their picture/name
    message = await message.populate('sender', 'fullName profilePic role');
    message = await message.populate('chatId');

    // 3. Update the Chat's "latestMessage" so the sidebar shows the snippet
    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

    res.json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send message" });
  }
};

// @desc    Get all messages for a specific chat window
// @route   GET /api/messages/:chatId
exports.allMessages = async (req, res) => {
  try {
    const messages = await Message.find({ chatId: req.params.chatId })
      .populate('sender', 'fullName profilePic role')
      .populate('chatId');
      
    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    // 1. Find all chats the user is a part of
    const chats = await Chat.find({ participants: req.user._id });
    const chatIds = chats.map(chat => chat._id);

    // 2. Count messages in those chats where this user's ID is NOT in the readBy array
    const unreadCount = await Message.countDocuments({
      chatId: { $in: chatIds },
      readBy: { $ne: req.user._id }
    });

    res.json({ count: unreadCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
};