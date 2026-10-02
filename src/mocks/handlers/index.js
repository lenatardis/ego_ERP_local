import { authHandlers } from './auth';
import { fabricHandlers } from './fabrics';
import { productHandlers } from './products';
import { vendorHandlers } from './vendors';

export const handlers = [
    ...authHandlers,
    ...fabricHandlers,
    ...productHandlers,
    ...vendorHandlers,
];
