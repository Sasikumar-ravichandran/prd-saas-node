const Chat = require('../models/Chat');
const User = require('../models/User');

// @desc    Create or fetch a 1-on-1 private chat
// @route   POST /api/chats
exports.accessPrivateChat = async (req, res) => {
  const { userId } = req.body; // The person we want to chat with

  if (!userId) return res.status(400).json({ message: "UserId is required" });

  try {
    // 1. Check if a private chat already exists between these two exact users
    let isChat = await Chat.find({
      type: 'private',
      $and: [
        { participants: { $elemMatch: { $eq: req.user._id } } },
        { participants: { $elemMatch: { $eq: userId } } }
      ]
    })
    .populate('participants', '-password')
    .populate('latestMessage');

    isChat = await User.populate(isChat, {
      path: 'latestMessage.sender',
      select: 'fullName role profilePic'
    });

    if (isChat.length > 0) {
      // Chat exists, send it back
      res.json(isChat[0]);
    } else {
      // 2. Chat doesn't exist, create a new one
      const chatData = {
        clinicId: req.user.clinicId, // Assuming you have clinicId on req.user
        type: 'private',
        chatName: 'Sender', // Dynamic on frontend
        participants: [req.user._id, userId]
      };

      const createdChat = await Chat.create(chatData);
      const fullChat = await Chat.findOne({ _id: createdChat._id }).populate('participants', '-password');
      res.status(200).json(fullChat);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error accessing chat" });
  }
};

// @desc    Fetch all chats for the logged in user (Sidebar list)
// @route   GET /api/chats
exports.fetchChats = async (req, res) => {
  try {
    const results = await Chat.find({ participants: { $elemMatch: { $eq: req.user._id } } })
      .populate('participants', '-password')
      .populate('latestMessage')
      .sort({ updatedAt: -1 });

    const populatedResults = await User.populate(results, {
      path: 'latestMessage.sender',
      select: 'fullName role profilePic'
    });

    res.status(200).json(populatedResults);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching chats" });
  }
};

// @desc    Create a Clinic-Wide or Branch Group Chat
// @route   POST /api/chats/group
exports.createGroupChat = async (req, res) => {
  const { chatName, type, branchId } = req.body; 

  try {
    // 1. Check if this exact group already exists to prevent duplicates!
    let query = { clinicId: req.user.clinicId, type: type };
    if (type === 'branch' && branchId) query.branchId = branchId;
    
    const existingGroup = await Chat.findOne(query).populate('participants', '-password');
    if (existingGroup) {
      return res.status(200).json(existingGroup); // Return existing instead of crashing or duplicating
    }

    // 2. Find users based on the type of group
    let userQuery = { clinicId: req.user.clinicId };
    if (type === 'branch' && branchId) {
      userQuery.branchId = branchId; // Only get staff from this specific branch
    }

    const targetUsers = await User.find(userQuery);

    // 3. Create the new group
    const groupChat = await Chat.create({
      clinicId: req.user.clinicId,
      type: type,
      chatName: chatName,
      branchId: branchId || null,
      participants: targetUsers.map(u => u._id)
    });

    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate('participants', '-password');

    res.status(200).json(fullGroupChat);
  } catch (error) {
    res.status(500).json({ message: "Failed to create group" });
  }
};