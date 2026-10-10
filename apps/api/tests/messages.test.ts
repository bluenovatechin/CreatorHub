/**
 * TESTS: messages between each creator/brand and the Bluenova team (they never message each other).
 * Ownership (only your own conversations and topics), unread counters, notifications, "Bluenova team" as the
 * sender for users, close/re-open, the team starting a conversation, and audit entries when the team reads one.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AuditLogModel, NotificationModel } from '../src/models/system';
import { UserModel } from '../src/models/user';
import { app, bearer, campaignWithDeal, loginAdmin, useDatabase } from './helpers';

useDatabase('messages_tests');

describe('messages with the team', () => {
  it('a creator writes about their own deal; the team reads, replies and closes; a new message re-opens it', async () => {
    const { creator, brand, dealId } = await campaignWithDeal('started');
    const cm = await loginAdmin('campaign_manager');
    const start = (token: string, body: object) => request(app).post('/api/v1/conversations').set(bearer(token)).send(body);

    expect((await start(creator.token, { subject: 'Hi', body: 'x' })).status).toBe(400); // subject too short
    expect((await start(brand.token, { subject: 'About a deal', body: 'Hello', topic: { type: 'DEAL', id: '64b000000000000000000000' } })).status).toBe(404);
    const conv = await start(creator.token, { subject: 'Question about my draft', body: 'Can I use music from Instagram?', topic: { type: 'DEAL', id: dealId } }).expect(201);
    const convId = conv.body.data.id as string;

    // Only the owner can see it; brands and creators never see each other's conversations.
    await request(app).get(`/api/v1/conversations/${convId}/messages`).set(bearer(brand.token)).expect(404);
    expect((await request(app).get('/api/v1/conversations').set(bearer(brand.token))).body.data).toEqual([]);

    // Team inbox: waiting, then read (audited), then reply.
    const inbox = await request(app).get('/api/v1/admin/conversations').set(bearer(cm.token)).expect(200);
    expect(inbox.body.data.find((c: { id: string }) => c.id === convId)).toMatchObject({ unread: 1, ownerRole: 'creator' });
    await request(app).get(`/api/v1/admin/conversations/${convId}/messages`).set(bearer(cm.token)).expect(200);
    expect(await AuditLogModel.exists({ action: 'conversation.view', entityId: convId })).toBeTruthy();
    expect((await request(app).get('/api/v1/admin/conversations').set(bearer(cm.token))).body.data.some((c: { id: string }) => c.id === convId)).toBe(false);
    await request(app).post(`/api/v1/admin/conversations/${convId}/messages`).set(bearer(cm.token)).send({ body: 'Yes, licensed Instagram audio is fine.' }).expect(201);
    expect(await NotificationModel.exists({ type: 'message_from_team' })).toBeTruthy();

    const mine = await request(app).get('/api/v1/conversations').set(bearer(creator.token)).expect(200);
    expect(mine.body.data[0].unread).toBe(1);
    const thread = await request(app).get(`/api/v1/conversations/${convId}/messages`).set(bearer(creator.token)).expect(200);
    expect(thread.body.data.messages.map((m: { from: string }) => m.from)).toEqual(['user', 'team']);
    expect(thread.body.data.messages[1]).not.toHaveProperty('senderName'); // users see "Bluenova team" only
    expect(JSON.stringify(thread.body.data)).not.toContain(cm.email);
    expect((await request(app).get('/api/v1/conversations').set(bearer(creator.token))).body.data[0].unread).toBe(0);

    // Close; a new message from the creator re-opens it.
    const closed = await request(app).post(`/api/v1/admin/conversations/${convId}/status`).set(bearer(cm.token)).send({ status: 'CLOSED' }).expect(200);
    expect(closed.body.data.status).toBe('CLOSED');
    await request(app).post(`/api/v1/conversations/${convId}/messages`).set(bearer(creator.token)).send({ body: 'One more question!' }).expect(201);
    expect((await request(app).get('/api/v1/conversations').set(bearer(creator.token))).body.data[0].status).toBe('OPEN');
    await request(app).post(`/api/v1/conversations/${convId}/messages`).set(bearer(brand.token)).send({ body: 'sneaky' }).expect(404);
  });

  it('the team can start a conversation with a creator or brand, never with a team account; website accounts cannot open the inbox', async () => {
    const { brand } = await campaignWithDeal('offer');
    const finance = await loginAdmin('finance');
    const brandUser = await UserModel.findOne({ email: brand.email }).lean();
    const started = await request(app).post('/api/v1/admin/conversations').set(bearer(finance.token))
      .send({ userId: String(brandUser!._id), subject: 'Your invoice', body: 'Please share your GSTIN.' }).expect(201);
    const forBrand = await request(app).get('/api/v1/conversations').set(bearer(brand.token)).expect(200);
    expect(forBrand.body.data[0]).toMatchObject({ id: started.body.data.id, unread: 1 });

    const teamUser = await UserModel.findOne({ email: finance.email }).lean();
    const bad = await request(app).post('/api/v1/admin/conversations').set(bearer(finance.token))
      .send({ userId: String(teamUser!._id), subject: 'Hello there', body: 'x' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toBe('errors.notAWebsiteAccount');
    await request(app).get('/api/v1/admin/conversations').set(bearer(brand.token)).expect(401);
  });
});

describe('auto-refreshing admin pages', () => {
  it('records a conversation view at most once per 10 minutes per admin', async () => {
    const { creator } = await campaignWithDeal('offer');
    const cm = await loginAdmin('campaign_manager');
    const conv = await request(app).post('/api/v1/conversations').set(bearer(creator.token)).send({ subject: 'Polling check', body: 'Hello team' }).expect(201);
    for (let i = 0; i < 4; i++) await request(app).get(`/api/v1/admin/conversations/${conv.body.data.id}/messages`).set(bearer(cm.token)).expect(200);
    expect(await AuditLogModel.countDocuments({ action: 'conversation.view', entityId: conv.body.data.id })).toBe(1);
  });
});
