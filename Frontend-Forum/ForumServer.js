const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;
const dataFilePath = path.join(__dirname, 'forum-data.json');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:asd@localhost:5432/forumdb'
});

let useDatabase = false;
let fallbackQuestions = [];

function toClientQuestion(row) {
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    body: row.body,
    tag: row.tag,
    author: row.author || 'You',
    date: row.date || new Date(row.created_at).toLocaleDateString(),
    status: row.status || 'pending',
    answer: row.answer || '',
    replies: row.replies ?? row.reply_count ?? 0
  };
}

function loadFallbackQuestions() {
  try {
    if (!fs.existsSync(dataFilePath)) {
      return [];
    }

    const raw = fs.readFileSync(dataFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Could not load fallback forum data:', error.message);
    return [];
  }
}

function saveFallbackQuestions(list) {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(list, null, 2));
  } catch (error) {
    console.warn('Could not save fallback forum data:', error.message);
  }
}

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        tag TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT 'You',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        status TEXT NOT NULL DEFAULT 'pending',
        answer TEXT,
        reply_count INTEGER NOT NULL DEFAULT 0
      )
    `);
    useDatabase = true;
    console.log('Database ready');
  } catch (error) {
    useDatabase = false;
    fallbackQuestions = loadFallbackQuestions();
    console.error('Database unavailable, using file-based fallback store:', error.message);
  }
}

app.use(express.json());

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next(err);
});

app.use(express.static(path.join(__dirname)));

app.get('/api/questions', async (req, res) => {
  if (useDatabase) {
    try {
      const result = await pool.query(
        `SELECT id, title, body, tag, author, created_at, status, answer, reply_count
         FROM questions
         ORDER BY created_at DESC`
      );

      return res.json(result.rows.map(toClientQuestion));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to load questions' });
    }
  }

  return res.json(fallbackQuestions.map((question) => ({ ...question, replies: question.replies || 0 })));
});

app.post('/api/questions', async (req, res) => {
  const { title, body, tag, author = 'You' } = req.body;

  if (!title || !body || !tag) {
    return res.status(400).json({ error: 'Title, body, and tag are required' });
  }

  if (useDatabase) {
    try {
      const result = await pool.query(
        `INSERT INTO questions (title, body, tag, author, status, reply_count)
         VALUES ($1, $2, $3, $4, 'pending', 0)
         RETURNING id, title, body, tag, author, created_at, status, answer, reply_count`,
        [title, body, tag, author]
      );

      return res.status(201).json(toClientQuestion(result.rows[0]));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to create question' });
    }
  }

  const createdQuestion = {
    id: Date.now(),
    title,
    body,
    tag,
    author,
    date: new Date().toLocaleDateString(),
    status: 'pending',
    answer: '',
    replies: 0
  };

  fallbackQuestions.unshift(createdQuestion);
  saveFallbackQuestions(fallbackQuestions);
  return res.status(201).json(createdQuestion);
});

app.delete('/api/questions/:id', async (req, res) => {
  const { id } = req.params;

  if (useDatabase) {
    try {
      const result = await pool.query(
        `DELETE FROM questions WHERE id = $1 RETURNING id`,
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Question not found' });
      }

      return res.status(204).send();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to delete question' });
    }
  }

  const originalLength = fallbackQuestions.length;
  fallbackQuestions = fallbackQuestions.filter((question) => String(question.id) !== String(id));

  if (fallbackQuestions.length === originalLength) {
    return res.status(404).json({ error: 'Question not found' });
  }

  saveFallbackQuestions(fallbackQuestions);
  return res.status(204).send();
});

app.post('/api/questions/:id/reply', async (req, res) => {
  const { id } = req.params;
  const { answer } = req.body;

  if (!answer) {
    return res.status(400).json({ error: 'Answer is required' });
  }

  if (useDatabase) {
    try {
      const result = await pool.query(
        `UPDATE questions
         SET answer = $1, status = 'answered', reply_count = reply_count + 1
         WHERE id = $2
         RETURNING id, title, body, tag, author, created_at, status, answer, reply_count`,
        [answer, id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Question not found' });
      }

      return res.json(toClientQuestion(result.rows[0]));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to send reply' });
    }
  }

  const targetQuestion = fallbackQuestions.find((question) => String(question.id) === String(id));
  if (!targetQuestion) {
    return res.status(404).json({ error: 'Question not found' });
  }

  targetQuestion.answer = answer;
  targetQuestion.status = 'answered';
  targetQuestion.replies = (targetQuestion.replies || 0) + 1;
  saveFallbackQuestions(fallbackQuestions);

  return res.json(targetQuestion);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Forum.html'));
});

initDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Forum server running on http://localhost:${port}`);
  });
});
