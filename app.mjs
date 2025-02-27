// app.mjs
import express from "express";
import path from "path";
import url from 'url'

export let server = null;
export const app = express();


//esmodle support
const basePath = path.dirname(url.fileURLToPath(import.meta.url))
const publicPath = path.resolve(basePath, 'public')
console.log("HELLOOO")


// Implement the decorate function
export const decorate = (answer, correct) => {
    return ""
}

// Middleware
app.use(express.static(publicPath));

// set server to port 3000
server = app.listen(3000, () => {
    console.log("Server started; type CTRL+C to shut down");
});

// Continue with the rest of the code
