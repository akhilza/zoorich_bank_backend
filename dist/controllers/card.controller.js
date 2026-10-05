"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardController = void 0;
const card_service_1 = require("../services/card.service");
class CardController {
    static async getCards(req, res) {
        try {
            const cards = await card_service_1.CardService.getCards(req.user.id);
            return res.json({ success: true, data: cards });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async issueCard(req, res) {
        try {
            const card = await card_service_1.CardService.issueCard(req.user.id, req.body);
            return res.status(201).json({ success: true, data: card });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async freezeCard(req, res) {
        try {
            const card = await card_service_1.CardService.freezeCard(req.user.id, req.params.id);
            return res.json({ success: true, data: card, message: 'Card frozen successfully' });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async unfreezeCard(req, res) {
        try {
            const card = await card_service_1.CardService.unfreezeCard(req.user.id, req.params.id);
            return res.json({ success: true, data: card, message: 'Card unfrozen successfully' });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async updateLimit(req, res) {
        try {
            const { limit } = req.body;
            const card = await card_service_1.CardService.updateLimit(req.user.id, req.params.id, Number(limit));
            return res.json({ success: true, data: card, message: 'Card limit updated' });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
}
exports.CardController = CardController;
