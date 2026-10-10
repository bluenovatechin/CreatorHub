/**
 * TESTS: the public Contact page form. Anyone can send (validated); spam-bot submissions (hidden field filled)
 * look successful but are not stored; the team lists and handles enquiries; website accounts can't read them.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { EnquiryModel } from '../src/models/enquiry';
import { AuditLogModel } from '../src/models/system';
import { app, bearer, loginAdmin, signup, useDatabase } from './helpers';

useDatabase('contact_tests');

const msg = { name: 'Asha Patel', email: 'asha@suratsweets.in', topic: 'BRAND', message: 'We want to promote our Diwali sweets with Surat creators.' };

describe('contact form', () => {
  it('stores real enquiries, ignores bots, and lets the team handle them', async () => {
    await request(app).post('/api/v1/contact').send({ ...msg, email: 'not-an-email' }).expect(400);
    await request(app).post('/api/v1/contact').send({ ...msg, message: 'short' }).expect(400);
    await request(app).post('/api/v1/contact').send(msg).expect(201);
    await request(app).post('/api/v1/contact').send({ ...msg, website: 'http://spam.example' }).expect(201);
    expect(await EnquiryModel.countDocuments()).toBe(1);

    const brand = await signup('brand');
    await request(app).get('/api/v1/admin/enquiries').set(bearer(brand.token)).expect(401);
    const finance = await loginAdmin('finance');
    const list = await request(app).get('/api/v1/admin/enquiries').set(bearer(finance.token)).expect(200);
    expect(list.body.data[0]).toMatchObject({ name: 'Asha Patel', topic: 'BRAND', status: 'OPEN' });
    expect(await AuditLogModel.exists({ action: 'enquiry.list' })).toBeTruthy();
    await request(app).post(`/api/v1/admin/enquiries/${list.body.data[0].id}/handled`).set(bearer(finance.token)).expect(200);
    await request(app).post(`/api/v1/admin/enquiries/${list.body.data[0].id}/handled`).set(bearer(finance.token)).expect(409);
    const dash = await request(app).get('/api/v1/admin/dashboard').set(bearer(finance.token)).expect(200);
    expect(dash.body.data.openEnquiries).toBe(0);
  });
});
