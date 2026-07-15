const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth'); 
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Initialize the Groq Client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    let text = '';

    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      
      // FIXED: Safeguard against variations in how pdf-parse exports its module properties
      const parseFunction = typeof pdfParse === 'function' ? pdfParse : pdfParse.default;
      if (!parseFunction) {
          throw new Error("PDF parsing library failed to initialize correctly.");
      }
      
      const pdfData = await parseFunction(dataBuffer);
      text = pdfData.text;
    } 
    else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath }); 
      text = result.value; 
    } 
    else if (ext === '.ppt' || ext === '.pptx' || ext === '.doc' || ext === '.xls' || ext === '.xlsx') {
      text = `Uploaded file type: ${ext}. The file was received successfully, but this setup only extracts text from PDFs and modern Word (.docx) files.`;
    } 
    else if (ext === '.txt' || ext === '.md' || ext === '.json' || ext === '.csv' || ext === '.rtf' || ext === '.html' || ext === '.htm' || ext === '.xml') {
      text = fs.readFileSync(filePath, 'utf8');
    } 
    else {
      return res.status(400).json({ error: 'Unsupported document type.' });
    }

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath); // Clear local temp upload copy safely from disk space
    }
    res.json({ text });
  } catch (error) {
    console.error('UPLOAD ERROR:', error.message || error);
    // Safety cleanup in case parsing failed halfway through execution
    if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to extract text from the uploaded file.' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { history, documentText, documentName } = req.body;

    if (!process.env.GROQ_API_KEY) {
      throw new Error('Groq API Key is missing! Check your .env file.');
    }

    if (!history || !Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ error: 'Conversation history is missing or empty.' });
    }

    const groqMessages = history.map((msg) => {
      const role = msg.role === 'model' ? 'assistant' : msg.role;

      let content = '';
      if (msg.parts) {
        if (Array.isArray(msg.parts) && msg.parts[0]) {
          content = msg.parts[0].text || '';
        } else {
          content = msg.parts.text || '';
        }
      }
      return { role, content };
    });

    let systemInstruction = 'Your name is Myra. You are nice and friendly, very lively! You are a study assistant. You help students understand topics they find challenging very easily and make them enjoy studying with you. You try to encourage them when they are struggling. IMPORTANT: Always use actual graphic emojis (like 😊, 🎉, 👍) to express emotion. Never write text descriptions of actions or faces like "*Big smile*" or "*smiles*".';

    if (documentText) {
      systemInstruction += `\n\nThe user uploaded a document named "${documentName || 'uploaded file'}". Use it as context when answering. If relevant, reference or summarize the document content. Here is the document content:\n${documentText}`;
    }

    groqMessages.unshift({
      role: 'system',
      content: systemInstruction
    });

    const chatCompletion = await groq.chat.completions.create({
      messages: groqMessages,
      model: 'llama-3.3-70b-versatile',
      max_tokens: 500
    });

    res.json({ reply: chatCompletion.choices[0].message.content });
  } catch (error) {
    console.error('SERVER ERROR LOG:', error.message || error);
    res.status(500).json({ error: 'Failed to fetch response from Myra via Groq' });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  next(err);
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Server running on port ${port}`));
