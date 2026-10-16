import { acquireExternalConnectionSlot, acquireExternalSequelize, releaseExternalSequelize } from "@/lib/externalDatabase";
import { requireTwoFactorApi } from "@/lib/requireTwoFactorApi";

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const session = await requireTwoFactorApi(req, res);
    const { form } = req.body || {};

    if (!session) return;
    if (typeof form?.url_connection !== "string" || form.url_connection.length > 4096) {
        return res.status(400).json({ error: "Invalid connection string." });
    }

    let sequelize;
    let releaseConnectionSlot;
    try {
        releaseConnectionSlot = await acquireExternalConnectionSlot();
        sequelize = await acquireExternalSequelize(form.url_connection);
        await sequelize.authenticate();
        return res.status(200).json({message: 'Connection has been established successfully.'})
    } catch (error) {
        console.error('Unable to connect to the database');
        return res.status(error.statusCode || 400).json({message: 'Unable to connect to the database.'})
    } finally {
        if (sequelize) {
            releaseExternalSequelize(sequelize);
        }
        await releaseConnectionSlot?.();
    }
}
