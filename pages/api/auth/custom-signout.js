// pages/api/auth/custom-signout.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `2fa_session=; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=0`);

    res.status(200).json({ success: true });
}
