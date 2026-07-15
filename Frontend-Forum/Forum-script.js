const tabs = document.querySelectorAll('.tabs button');
const questionsContainer = document.getElementById('questionsContainer');
const questionForm = document.getElementById('questionForm');
const questionTitleInput = document.getElementById('questionTitle');
const questionBodyInput = document.getElementById('questionBody');
const questionTagInput = document.getElementById('questionTag');
const searchInput = document.getElementById('searchInput');
const STORAGE_KEY = 'forum-questions';

let currentFilter = 'all';
let currentQuestion = '';
let questions = [];

function readLocalQuestions() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Could not read forum questions:', error);
        return [];
    }
}

function saveLocalQuestions(list) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (error) {
        console.warn('Could not save forum questions:', error);
    }
}

async function parseJsonResponse(response) {
    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error('The server returned an invalid response.');
    }
}

function createQuestionCard(question) {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-status', question.status);
    card.setAttribute('data-id', question.id);

    const initials = (question.author || 'You')
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase();

    card.innerHTML = `
        <span class="status ${question.status === 'answered' ? 'answered' : 'pending'}">${question.status === 'answered' ? 'Answered' : 'Pending'}</span>
        <div class="user">
            <div class="avatar">${initials}</div>
            <div>
                <h3>${question.title}</h3>
                <small>${question.author} • ${question.date}</small>
            </div>
        </div>
        <p class="question">${question.body}</p>
        <div class="tags">
            <span>${question.tag}</span>
            <span>TO: LECTURER</span>
        </div>
        ${question.answer ? `
            <div class="answer-box">
                <h4>LECTURER'S ANSWER</h4>
                <p>${question.answer}</p>
            </div>` : ''}
        <div class="card-footer">
            <div class="card-actions">
                <button class="reply" data-question="${question.title}">Reply</button>
                ${question.author === 'You' ? '<button class="delete-question" type="button">Delete</button>' : ''}
            </div>
            <div class="comments">
                <i class="fa-solid fa-comment"></i> ${question.replies} Replies
            </div>
        </div>
    `;

    return card;
}

function updateCounts() {
    let answered = 0;
    let pending = 0;
    let total = questions.length;

    questions.forEach(question => {
        if (question.status === 'answered') answered++;
        if (question.status === 'pending') pending++;
    });

    document.getElementById('allCount').textContent = total;
    document.getElementById('answeredCount').textContent = answered;
    document.getElementById('pendingCount').textContent = pending;
}

function renderQuestions() {
    const searchValue = searchInput.value.toLowerCase().trim();
    const visibleQuestions = questions.filter(question => {
        const matchesFilter = currentFilter === 'all' || question.status === currentFilter;
        const matchesSearch = !searchValue || `${question.title} ${question.body} ${question.tag}`.toLowerCase().includes(searchValue);
        return matchesFilter && matchesSearch;
    });

    questionsContainer.innerHTML = '';
    visibleQuestions.forEach(question => {
        questionsContainer.appendChild(createQuestionCard(question));
    });

    updateCounts();
    attachReplyHandlers();
    attachDeleteHandlers();
}

function attachReplyHandlers() {
    const isLecturer = (localStorage.getItem('myra_current_role') || '').toLowerCase() === 'lecturer';
    document.querySelectorAll('.reply').forEach(button => {
        button.style.display = isLecturer ? 'inline-flex' : 'none';
        button.addEventListener('click', function (e) {
            if (!isLecturer) return;
            e.stopPropagation();
            currentQuestion = this.getAttribute('data-question') || 'Question';
            document.getElementById('replyQuestionTitle').textContent = currentQuestion;
            document.getElementById('replyModal').classList.add('active');
            document.getElementById('replyText').value = '';
            document.getElementById('replyText').focus();
        });
    });
}

function attachDeleteHandlers() {
    document.querySelectorAll('.delete-question').forEach(button => {
        button.addEventListener('click', async function (e) {
            e.stopPropagation();
            const card = this.closest('.card');
            const questionId = card?.dataset?.id;
            const targetQuestion = questions.find(question => String(question.id) === String(questionId));

            if (!targetQuestion) return;

            const confirmed = window.confirm('Delete this question?');
            if (!confirmed) return;

            try {
                const response = await fetch(`/api/questions/${targetQuestion.id}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Delete failed');
                questions = questions.filter(question => String(question.id) !== String(targetQuestion.id));
                saveLocalQuestions(questions);
                renderQuestions();
                alert('Question deleted.');
            } catch (error) {
                questions = questions.filter(question => String(question.id) !== String(targetQuestion.id));
                saveLocalQuestions(questions);
                renderQuestions();
                alert('Question removed locally.');
            }
        });
    });
}

function filterCards(filter) {
    currentFilter = filter;
    renderQuestions();
}

tabs.forEach(tab => {
    tab.addEventListener('click', function () {
        tabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        filterCards(this.getAttribute('data-filter'));
    });
});

function closeReplyModal() {
    document.getElementById('replyModal').classList.remove('active');
}

async function submitReply() {
    const replyText = document.getElementById('replyText').value.trim();
    if (!replyText) {
        alert('Please type your reply before submitting.');
        return;
    }

    const targetQuestion = questions.find(question => question.title === currentQuestion);
    if (!targetQuestion) {
        alert('Could not find the selected question.');
        closeReplyModal();
        return;
    }

    try {
        const response = await fetch(`/api/questions/${targetQuestion.id}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer: replyText })
        });

        const updated = await parseJsonResponse(response);
        if (!response.ok) {
            const serverMessage = updated && updated.error ? updated.error : 'Failed to send reply';
            throw new Error(serverMessage);
        }

        targetQuestion.answer = updated.answer;
        targetQuestion.status = updated.status;
        targetQuestion.replies = updated.replies;
        renderQuestions();
        closeReplyModal();
        alert('✅ Reply submitted successfully!');
    } catch (error) {
        console.error('Reply submission failed:', error);
        alert(error.message || 'Failed to send reply');
    }
}

document.getElementById('replyModal').addEventListener('click', function (e) {
    if (e.target === this) {
        closeReplyModal();
    }
});

questionForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const tagValue = questionTagInput.value.trim();
    const newQuestion = {
        title: questionTitleInput.value.trim(),
        body: questionBodyInput.value.trim(),
        tag: tagValue || 'General',
        author: 'You'
    };

    if (!newQuestion.title || !newQuestion.body || !tagValue) return;

    try {
        const response = await fetch('/api/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newQuestion)
        });

        const created = await parseJsonResponse(response);
        if (!response.ok) throw new Error((created && created.error) || 'Failed to create question');

        questions.unshift(created);
        saveLocalQuestions(questions);
        questionForm.reset();
        renderQuestions();
    } catch (error) {
        const fallbackQuestion = {
            id: Date.now(),
            title: newQuestion.title,
            body: newQuestion.body,
            tag: newQuestion.tag,
            author: 'You',
            date: new Date().toLocaleDateString(),
            status: 'pending',
            answer: '',
            replies: 0
        };
        questions.unshift(fallbackQuestion);
        saveLocalQuestions(questions);
        questionForm.reset();
        renderQuestions();
        console.error(error);
    }
});

searchInput.addEventListener('keyup', renderQuestions);
searchInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        renderQuestions();
    }
});

async function loadQuestions() {
    const localQuestions = readLocalQuestions();

    try {
        const response = await fetch('/api/questions');
        const data = await parseJsonResponse(response);
        if (Array.isArray(data) && data.length) {
            questions = data;
            saveLocalQuestions(questions);
        } else {
            questions = localQuestions;
        }
        renderQuestions();
    } catch (error) {
        console.error(error);
        questions = localQuestions;
        renderQuestions();
    }
}

window.closeReplyModal = closeReplyModal;
window.submitReply = submitReply;
loadQuestions();
