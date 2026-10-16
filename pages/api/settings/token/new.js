import db from "@/lib/db";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";

export default async function handler(req, res) {
    const session = await requireTwoFactorApi(req, res);
    if (!session) return;

    function generateRandomString(length) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}|;:,.<>?';
        let result = '';
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    try {
            await db.$connect();
            const fetchUser = await db.user.findUnique({
                where: {
                    id: session.id
                }
            });

            const response = await fetch('http://127.0.0.1:8000/api/register/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: fetchUser.email,
                    password: generateRandomString(20)
                }),
            });


            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const responseData = await response.json();

            await db.user.update({
                where: {
                    email: fetchUser.email
                },
                data: {
                    token: responseData.token,
                }
            })

            await db.$disconnect();
            return res.status(201).json(responseData);
    } catch (error) {
        console.error('Fetch error:', error);
        await db.$disconnect();
        return res.status(400).json({ message: 'A user with that username already exists.' });
    }
}
