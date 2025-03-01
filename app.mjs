// app.mjs
import express from "express";
import path from "path";
import url from "url";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

import { Query } from "./query.mjs";

export let server = null;
export const app = express();

// ESM module directory tracking
const basePath = path.dirname(url.fileURLToPath(import.meta.url));
const publicPath = path.resolve(basePath, "public");
const questionBankPath = path.resolve(basePath, "code-samples", "question-bank.json");
const viewsPath = path.join(basePath, "public", "views"); // .hbs are in public/views

app.set("view engine", "hbs");
app.set("views", viewsPath);


// global array to hold queries in memory
let queries = [];

// decorate for the tests
export const decorate = (answer, correct) => {
  if (correct) {
    return `<span class="correct-answer">${answer}</span>`;
  } else {
    return `<span class="incorrect-answer">${answer}</span>`;
  }
};

// custom middleware to log requests
function loggerMiddleware(req, res, next) {
  console.log("Method:", req.method);
  console.log("Path:", req.path);
  console.log(req.query);  
  next();
}

// use the middleware and static files
app.use(loggerMiddleware);
app.use(express.static(publicPath));
app.use(express.urlencoded({ extended: false }));

// set up handlebars as view engine
app.set("view engine", "hbs");

// rRoot route: redirect to /quiz
app.get("/", (req, res) => {
  res.redirect("/quiz");
});

// GET /quiz -> show a random question
app.get("/quiz", (req, res) => {
  if (queries.length === 0) {
    // if no queries / can't load queries
    return res.send("No questions available!");
  }

  // pick random question
  const randIndex = Math.floor(Math.random() * queries.length);
  const randomQuestion = queries[randIndex];

  // render the quiz page with the question & hidden id
  res.render("quiz", {
    question: randomQuestion.question,
    id: randomQuestion.id,
    // empty answer and correction passed in by default
    answer: "",
    correction: "",
    status: ""
  });
});

// POST /quiz -> check the user's answers
app.post("/quiz", (req, res) => {
  // The quiz form will send "id" (hidden field) and "answer" (user typed)
  const { id, answer } = req.body;

  // 1) Find the question from the queries array
  const quizQuestion = queries.find(q => q.id === id);

  if (!quizQuestion) {
    // if question not found
    return res.send("Invalid question submitted.");
  }

  // split user answers by comma
  const userAnswers = answer
    .split(",")
    .map(a => a.trim())
    .filter(a => a.length > 0);

  // check each user answer vs the real answers
  const decoratedAnswers = userAnswers.map(ans => {
    const isCorrect = quizQuestion.answers.some(
      correctAns => correctAns.toLowerCase() === ans.toLowerCase()
    );
    return decorate(ans, isCorrect);
  });

  // determine the amount of correctness
let status = "";
const lowerCorrect = quizQuestion.answers.map(a => a.toLowerCase());
const lowerUser = userAnswers.map(a => a.toLowerCase());

// if all user answers are correct AND distinct
const allCorrect = 
  lowerUser.length === lowerCorrect.length &&
  new Set(lowerUser).size === lowerCorrect.length &&
  lowerUser.every(ans => lowerCorrect.includes(ans));

if (allCorrect) {
  status = "Correct";
} else if (lowerUser.some(ans => lowerCorrect.includes(ans))) {
  status = "Partially Correct";
} else {
  status = "Incorrect";
}

  

  // re-render quiz question but keep the same page
  res.render("quiz", {
    question: quizQuestion.question,
    id: quizQuestion.id,
    answer, // keep the user's typed answer in the input
    correction: decoratedAnswers.join(", "),
    status
  });
});





// GET & POST /questions -> display existing queries and add new ones
app.get("/questions", (req, res) => {
    const { search } = req.query;
  
    // if no search, display everything
    let filtered = queries;

    if (search) {
    const s = search.toLowerCase();
    filtered = queries.filter(q => {
        const matchQuestion = q.question.toLowerCase().includes(s);
        const matchGenre = q.genre.toLowerCase().includes(s);
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
    console.log("DEBUG: new question body:", req.body);
    // for the "add new question" form
    const { question, genre, answers } = req.body;
  
    // convert answers to an array
    const ansArr = answers
      .split(",")
      .map(a => a)
      .filter(a => a.length > 0);
  
    // create a new Query object
    const newQuery = new Query(
      uuidv4(),
      question,
      genre,
      ansArr
    );
  
    // add to global array
    queries.push(newQuery);
  
    // redirect to /questions so that the user sees the updated list
    // so a page refresh won't re-POST the same question
    res.redirect("/questions");
  });
  
  // load the JSON file, populate "queries", then start the server
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
  
  
  