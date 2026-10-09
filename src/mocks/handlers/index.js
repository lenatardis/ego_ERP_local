import { authHandlers } from './auth';
import { fabricHandlers } from './fabrics';
import { fabricArrivalHandlers } from './fabricArrivals';
import { productHandlers } from './products';
import { vendorHandlers } from './vendors';
import { vendorPaymentHandlers } from './vendorPayments';
import { privatPaymentHandlers } from './privatPayments';
import { crmPaymentHandlers } from './crmPayments';
import { pricelistHandlers } from './pricelists';
import { calculatorTemplateHandlers } from './calculatorTemplates';
import { priceHandlers } from './prices';

export const handlers = [
    ...authHandlers,
    ...fabricHandlers,
    ...fabricArrivalHandlers,
    ...productHandlers,
    ...vendorHandlers,
    ...vendorPaymentHandlers,
    ...privatPaymentHandlers,
    // after privatPaymentHandlers: /payment_bill/:id/ would also match /payment_bill/coincidence
    ...crmPaymentHandlers,
    ...pricelistHandlers,
    ...calculatorTemplateHandlers,
    ...priceHandlers,
];
