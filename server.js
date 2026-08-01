import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
    res.send("Vamshi backend is running!");
});

app.post("/chat", async (req, res) => {

    try {

        const message = req.body.message;

        const response = await client.responses.create({
            model: "gpt-4o-mini",
            input: message
        });

        console.log(JSON.stringify(response, null, 2));

        let reply = "Sorry, I couldn't understand.";

        if (response.output_text) {

            reply = response.output_text;

        } else if (
            response.output &&
            response.output[0] &&
            response.output[0].content &&
            response.output[0].content[0] &&
            response.output[0].content[0].text
        ) {

            reply = response.output[0].content[0].text;

        }

        res.json({
            reply: String(reply)
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            reply: "Sorry, my brain is temporarily unavailable."
        });

    }

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});