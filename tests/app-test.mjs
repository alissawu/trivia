import { expect } from 'chai';
import { JSDOM } from 'jsdom';
import request from "supertest";
import { app, decorate, server } from '../app.mjs';

const validate = (response, queries, include = true) => {
    if (include) {
        queries.forEach(query => {
            expect(response.text).to.include(query.question.replace(/'/g, '&#x27;'));
            expect(response.text).to.include(query.genre);
            query.answers.forEach(ans => {
                expect(response.text).to.include(ans);
            });
        });
    } else {
        queries.forEach(query => {
            expect(response.text).to.not.include(query.question.replace(/'/g, '&#x27;'));
            expect(response.text).to.not.include(query.genre);
            query.answers.forEach(ans => {
                expect(response.text).to.not.include(ans);
            });
        });
    }
};

const getId = (response) => {
    const dom = new JSDOM(response.text);
    const document = dom.window.document;
    const idInput = document.querySelector('input[name="id"]');
    const idValue = idInput ? idInput.value : null;
    return idValue;
};

describe('App', function () {
    let queries;
    let originalMath;
    let mockMath;
    let randQuery;

    before(function () {
        originalMath = global.Math;
        mockMath = Object.create(global.Math);
        mockMath.random = () => 0.5;
        global.Math = mockMath;

        queries = [
            {
                "question": "Which movies are based on books written by J.R.R. Tolkien?",
                "genre": "film",
                "answers": ["The Lord of the Rings", "The Hobbit"]
            },
            {
                "question": "Name the actors that have played the character of Spiderman in movies?",
                "genre": "film",
                "answers": ["Tobey Maguire", "Andrew Garfield", "Tom Holland"]
            },
            {
                "question": "Name the world's five oceans",
                "genre": "geography",
                "answers": ["Pacific", "Atlantic", "Indian", "Antarctic", "Arctic"]
            },
            {
                "question": "Name the world's five largest countries by land area (any order)",
                "genre": "geography",
                "answers": ["Russia", "Canada", "China", "United States", "Brazil"]
            }
        ];

        randQuery = queries[2];
    });

    describe('GET /', function () {
        it('should redirect to quiz page', async function () {
            const response = await request(app).get('/');
            expect(response.redirect).to.eql(true);
            expect(response.status).to.eql(302);
            expect(response.headers.location).to.eql('/quiz');
        });
    });

    describe('GET /img/logo.png', function () {
        it('should display image file from the static folder', async function () {
            const response = await request(app).get('/img/logo.png');
            expect(response.status).to.be.eql(200);
            expect(response.headers['content-type']).to.eql('image/png');
        });
    });

    describe('GET /quiz', function () {
        it('should render quiz page', async function () {
            const response = await request(app).get('/quiz');
            expect(response.status).to.eql(200);
            const question = randQuery.question.replace(/'/g, '&#x27;');
            expect(response.text).to.include(question);
            randQuery.answers.forEach(ans => {
                expect(response.text).to.not.include(ans);
            });
        });
    });

    describe('POST /quiz', function () {
        it('should render quiz page with the given answers', async function () {
            const getResponse = await request(app).get('/quiz');
            const uuid = getId(getResponse);
            const answers = `Pacific, Atlantic, American, Antarctic`;
            const response = await request(app)
                .post('/quiz')
                .send(`answer=${answers}&id=${uuid}`);
            expect(response.status).to.eql(200);
            expect(response.text).to.include(answers);
        });

        it('should render quiz page with the corrections', async function () {
            const getResponse = await request(app).get('/quiz');
            const uuid = getId(getResponse);
            const answers = `Pacific, Atlantic, American, Antarctic`;

            const corrections = `${decorate('Pacific', true)}, ${decorate('Atlantic', true)}, ${decorate('American', false)}, ${decorate('Antarctic', true)}`;

            const response = await request(app)
                .post('/quiz')
                .send(`answer=${answers}&id=${uuid}`);
            expect(response.status).to.eql(200);
            expect(response.text).to.include(corrections);
        });

        it('should render quiz page with the status as Incorrect', async function () {
            const getResponse = await request(app).get('/quiz');
            const uuid = getId(getResponse);
            const answers = `American, African`;

            const response = await request(app)
                .post('/quiz')
                .send(`answer=${answers}&id=${uuid}`);
            expect(response.status).to.eql(200);
            expect(response.text).to.include('Incorrect');
        });

        it('should render quiz page with the status as Partially Correct', async function () {
            const getResponse = await request(app).get('/quiz');
            const uuid = getId(getResponse);
            const answers = `Pacific, Atlantic, Antarctic`;

            const response = await request(app)
                .post('/quiz')
                .send(`answer=${answers}&id=${uuid}`);
            expect(response.status).to.eql(200);
            expect(response.text).to.include('Partially Correct');
        });

        it('should render quiz page with the status as Partially Correct even if number of answers match', async function () {
            const getResponse = await request(app).get('/quiz');
            const uuid = getId(getResponse);
            const answers = `Pacific, Atlantic, Antarctic, Arctic, Arctic`;

            const response = await request(app)
                .post('/quiz')
                .send(`answer=${answers}&id=${uuid}`);
            expect(response.status).to.eql(200);
            expect(response.text).to.include('Partially Correct');
        });

        it('should render quiz page with the status as Correct', async function () {
            const getResponse = await request(app).get('/quiz');
            const uuid = getId(getResponse);
            const answers = `Pacific, Atlantic, Antarctic, Arctic, Indian`;

            const response = await request(app)
                .post('/quiz')
                .send(`answer=${answers}&id=${uuid}`);
            expect(response.status).to.eql(200);
            expect(response.text).to.include('Correct');
        });
    });

    describe('GET /questions', function () {
        it('should render questionnaire page and display all the questions', async function () {
            const response = await request(app).get('/questions');
            expect(response.status).to.eql(200);
            validate(response, queries);
        });

        it('should display all the queries where the search string matches part of the question', async function () {
            const filteredQueries = queries.slice(0, 2);
            const removedQueries = queries.slice(2);

            const response = await request(app)
                .get('/questions')
                .query({ search: 'movies' });

            expect(response.status).to.be.eql(200);
            validate(response, filteredQueries);
            validate(response, removedQueries, false);
        });

        it('should display all the queries where the search string matches part of the genre', async function () {
            const filteredQueries = queries.slice(0, 2);
            const removedQueries = queries.slice(2);

            const response = await request(app)
                .get('/questions')
                .query({ search: 'film' });

            expect(response.status).to.be.eql(200);
            validate(response, filteredQueries);
            validate(response, removedQueries, false);
        });

        it('should display all the queries where the search string matches part of the answers', async function () {
            const filteredQueries = queries.slice(3);
            const removedQueries = queries.slice(0, 2);
            
            console.log(filteredQueries);
            console.log(removedQueries);
            const response = await request(app)
                .get('/questions')
                .query({ search: 'Canada' });

            expect(response.status).to.be.eql(200);
            validate(response, filteredQueries);
            validate(response, removedQueries, false);
        });
    });

    describe('POST /questions', function () {
        it('should render questions page and display all the existing queries and the new query', async function () {
            const newQuery = {
                question: "Name the different primitive data types in JavaScript",
                genre: "JavaScript",
                answers: "boolean, number, string, object, function, undefined, symbol, null"
            };
            const response = await request(app)
                .post('/questions')
                .type('form')
                .send(newQuery);
            expect(response.status).to.be.within(300, 399);

            const redirectUrl = response.headers.location;

            const redirectRes = await request(app)
                .get(redirectUrl)
                .expect(200);

            validate(redirectRes, queries);

            expect(redirectRes.text).to.include(newQuery.question.replace(/'/g, '&#x27;'));
            expect(redirectRes.text).to.include(newQuery.genre);
            newQuery.answers.split(',').forEach(ans => {
                expect(redirectRes.text).to.include(ans);
            });
        });
    });

    after(function () {
        global.Math = originalMath;
        server.close(() => { });
    });
});