require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_URI = 'mongodb://q_nnn412:5EeXoefEmubeO79O@ac-zt9gung-shard-00-00.bgzuhgw.mongodb.net:27017,ac-zt9gung-shard-00-01.bgzuhgw.mongodb.net:27017,ac-zt9gung-shard-00-02.bgzuhgw.mongodb.net:27017/?ssl=true&replicaSet=atlas-zt9gung-shard-0&authSource=admin&retryWrites=true&w=majority&appName=qnnn412';

// Models
const userSchema = new mongoose.Schema({
  id: Number,
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  achievements: [String],
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const messageSchema = new mongoose.Schema({
  id: Number,
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  seed: { type: Boolean, default: false }
});
const Message = mongoose.model('Message', messageSchema);

const questionSchema = new mongoose.Schema({
  id: Number,
  content: { type: String, required: true },
  author: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  answered: { type: Boolean, default: false }
});
const Question = mongoose.model('Question', questionSchema);

async function importData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected!');

    const dataDir = path.join(__dirname, 'data');
    
    // 1. Import Users
    if (fs.existsSync(path.join(dataDir, 'users.json'))) {
      const usersData = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
      if (usersData.length > 0) {
        await User.deleteMany({});
        await User.insertMany(usersData);
        console.log(`Imported ${usersData.length} users.`);
      }
    }

    // 2. Import Messages
    if (fs.existsSync(path.join(dataDir, 'messages.json'))) {
      const messagesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'messages.json'), 'utf8'));
      if (messagesData.length > 0) {
        await Message.deleteMany({});
        await Message.insertMany(messagesData);
        console.log(`Imported ${messagesData.length} messages.`);
      }
    }

    // 3. Import Questions
    if (fs.existsSync(path.join(dataDir, 'questions.json'))) {
      const questionsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'questions.json'), 'utf8'));
      if (questionsData.length > 0) {
        await Question.deleteMany({});
        await Question.insertMany(questionsData);
        console.log(`Imported ${questionsData.length} questions.`);
      }
    }

    console.log('Data import complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error importing data:', err);
    process.exit(1);
  }
}

importData();
