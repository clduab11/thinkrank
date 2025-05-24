import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';

const router = Router();

// Payment processing routes
router.post('/create-intent', paymentController.createPaymentIntent);
router.post('/confirm', paymentController.confirmPayment);
router.post('/webhook', paymentController.handleWebhook);

// Subscription payment routes
router.post('/subscribe', paymentController.processSubscription);
router.post('/update-payment-method', paymentController.updatePaymentMethod);

// Billing history
router.get('/history', paymentController.getPaymentHistory);
router.get('/invoices', paymentController.getInvoices);

export { router as paymentRoutes };
