// app.mjs
import express from "express";
import path from "path";
import url from "url";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

import { Query } from "./query.mjs";

export let server = null;
export const app = express();

// -- 1. ESM module directory housekeeping
const basePath = path.dirname(url.fileURLToPath(import.meta.url));
const publicPath = path.resolve(basePath, "public");
const questionBankPath = path.resolve(basePath, "code-samples", "question-bank.json");
const viewsPath = path.join(basePath, "public", "views"); // if your .hbs are in public/views

app.set("view engine", "hbs");
app.set("views", viewsPath);


// -- 2. Global array to hold queries in memory
let queries = [];

// -- 3. Export decorate for the tests
export const decorate = (answer, correct) => {
  if (correct) {
    return `<span class="correct-answer">${answer}</span>`;
  } else {
    return `<span class="incorrect-answer">${answer}</span>`;
  }
};

// -- 4. Custom middleware to log requests
function loggerMiddleware(req, res, next) {
  console.log("Method:", req.method);
  console.log("Path:", req.path);
  console.log(req.query);  // e.g. { search: 'someValue' }
  // Don't forget to call next()!
  next();
}

// -- 5. Use the middleware and static files
app.use(loggerMiddleware);
app.use(express.static(publicPath));
app.use(express.urlencoded({ extended: false }));

// -- 6. Set up handlebars as view engine
app.set("view engine", "hbs");

// -- 7. Root route: redirect to /quiz
app.get("/", (req, res) => {
  res.redirect("/quiz");
});

// -- 8. GET /quiz -> show a random question
app.get("/quiz", (req, res) => {
  if (queries.length === 0) {
    // If for some reason we couldn't load queries
    return res.send("No questions available!");
  }

  // pick random question
  const randIndex = Math.floor(Math.random() * queries.length);
  const randomQuestion = queries[randIndex];

  // Render the quiz page with the question & hidden id
  res.render("quiz", {
    question: randomQuestion.question,
    id: randomQuestion.id,
    // We'll also pass an empty "answer" & "correction" by default
    answer: "",
    correction: "",
    status: ""
  });
});

// -- 9. POST /quiz -> check the user's answers
app.post("/quiz", (req, res) => {
  // The quiz form will send "id" (hidden field) and "answer" (user typed)
  const { id, answer } = req.body;

  // 1) Find the question from the queries array
  const quizQuestion = queries.find(q => q.id === id);

  if (!quizQuestion) {
    // If the question is not found for some reason
    return res.send("Invalid question submitted.");
  }

  // 2) Split user answers by comma
  //    e.g. if user typed "The Hobbit, The Lord of the Rings"
  //    we'll get ["The Hobbit", "The Lord of the Rings"]
  const userAnswers = answer
    .split(",")
    .map(a => a.trim())
    .filter(a => a.length > 0);

  // 3) Check each user answer vs the real answers
  //    quizQuestion.answers is an array of correct strings
  //    We want to decorate each user answer to highlight correct/incorrect
  let correctCount = 0;
  const decoratedAnswers = userAnswers.map(ans => {
    const isCorrect = quizQuestion.answers.some(
      correctAns => correctAns.toLowerCase() === ans.toLowerCase()
    );
    if (isCorrect) {
      correctCount++;
    }
    return decorate(ans, isCorrect);
  });

  // 4) Determine the status:
  //    - "Incorrect" if correctCount === 0
  //    - "Correct"   if correctCount === # of real answers
  //    - "Partially Correct" otherwise
  let status = "";
  if (correctCount === 0) {
    status = "Incorrect";
  } else if (correctCount === quizQuestion.answers.length &&
             userAnswers.length === quizQuestion.answers.length) {
    status = "Correct";
  } else {
    status = "Partially Correct";
  }

  // 5) Re-render the quiz.hbs page but keep the same question
  //    Note how we do not generate a new random question here.
  res.render("quiz", {
    question: quizQuestion.question,
    id: quizQuestion.id,
    answer,            // keep the user's typed answer in the input
    correction: decoratedAnswers.join(", "),
    status
  });
});

// -- 10. GET & POST /questions -> display existing queries and add new ones
app.get("/questions", (req, res) => {
  const { search } = req.query;

  // If no search, display everything
  let filtered = queries;

  if (search) {
    // Case-insensitive partial match on question, genre, or an answer
    const s = search.toLowerCase();
    filtered = queries.filter(q => {
      // Check question
      const matchQuestion = q.question.toLowerCase().includes(s);
      // Check genre
      const matchGenre = q.genre.toLowerCase().includes(s);
      // Check answers
      const matchAnswers = q.answers.some(ans =>
        ans.toLowerCase().includes(s)
      );
      return matchQuestion || matchGenre || matchAnswers;
    });
  }

  res.render("questions", {
    queries: filtered,
    search: search || ""
  });
});

app.post("/questions", (req, res) => {
  // For the "add new question" form
  const { question, genre, answers } = req.body;

  // Convert answers to an array
  const ansArr = answers
    .split(",")
    .map(a => a.trim())
    .filter(a => a.length > 0);

  // Create a new Query object
  const newQuery = new Query(
    uuidv4(),
    question,
    genre,
    ansArr
  );

  // Add to our global array
  queries.push(newQuery);

  // We should redirect to /questions so that the user sees the updated list
  // and so that a page refresh won't re-POST the same question
  res.redirect("/questions");
});

// -- 11. Load the JSON file, populate "queries", then start the server
fs.readFile(questionBankPath, "utf8", (err, data) => {
  if (err) {
    console.error("Error reading question-bank.json:", err);
    process.exit(1);
  }

  try {
    const parsed = JSON.parse(data);
    queries = parsed.map(item => {
      return new Query(
        uuidv4(),
        item.question,
        item.genre,
        item.answers
      );
    });
    console.log("Loaded questions from JSON. Starting server...");

    server = app.listen(3000, () => {
      console.log("Server started on http://localhost:3000");
      console.log("Type CTRL+C to shut down");
    });
  } catch (jsonErr) {
    console.error("Error parsing JSON:", jsonErr);
    process.exit(1);
  }
});
