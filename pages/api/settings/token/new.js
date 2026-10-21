import { randomInt } from "node:crypto";
import db from "@/lib/db";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed." });
    }
    const session = await requireTwoFactorApi(req, res);
    if (!session) return;

    function generateRandomString(length) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}|;:,.<>?';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(randomInt(characters.length));
        }
        return result;
    }

    try {
        const fetchUser = await db.user.findUnique({
            where: { id: session.id },
        });

        const response = await fetch('http://127.0.0.1:8000/api/register/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: fetchUser.email,
                password: generateRandomString(20),
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const responseData = await response.json();
        await db.user.update({
            where: { email: fetchUser.email },
            data: { token: responseData.token },
        });

        return res.status(201).json(responseData);
    } catch (error) {
        console.error('Fetch error:', error);
        return res.status(400).json({ message: 'A user with that username already exists.' });
    }
}
