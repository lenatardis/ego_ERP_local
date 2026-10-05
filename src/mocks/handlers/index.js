import { authHandlers } from './auth';
import { fabricHandlers } from './fabrics';
import { fabricArrivalHandlers } from './fabricArrivals';
import { productHandlers } from './products';
import { vendorHandlers } from './vendors';
import { vendorPaymentHandlers } from './vendorPayments';
import { privatPaymentHandlers } from './privatPayments';

export const handlers = [
    ...authHandlers,
    ...fabricHandlers,
    ...fabricArrivalHandlers,
    ...productHandlers,
    ...vendorHandlers,
    ...vendorPaymentHandlers,
    ...privatPaymentHandlers,
];
