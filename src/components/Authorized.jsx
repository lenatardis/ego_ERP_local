import React from "react";
import Navigation from "./Navigation/Navigation";
import {Route, Routes, Navigate} from "react-router-dom";
import FabricComposition from "./FabricComposition/FabricComposition";
import Order from "./Order/Order";
import Orders from "./Orders/Orders";
import Finances from "./Finances/Finances";
import Bills from "./Bills/Bills";
import FinancesCreate from "./FinancesCreate/FinancesCreate";
import PaymentForOrders from "./PaymentForOrders/PaymentForOrders";
import StorageProduct from "./FabricComposition/StorageProduct/StorageProduct.jsx";
import ArrivalList from "./ArrivalList/ArrivalList.jsx";
import NewFabric from "./FabricComposition/components/NewFabric/NewFabric.jsx";
import NewProduct from "./FabricComposition/components/NewProduct/NewProduct.jsx";
import NewPrices from "./NewPrices/NewPrices.jsx";
import {UnsavedChangesProvider} from "../guards/UnsavedChangesContext";
import {useUnsavedChangesGuard} from "../guards/useUnsavedChangesGuard";
import Pricelist from "./Pricelist/Pricelist.jsx";
import Sources from "./Sources/Sources.jsx";
import IncomingArrivalFabric from "./FabricComposition/components/IncomingArrivalFabric/IncomingArrivalFabric.jsx";
import IncomingArrivalProduct from "./FabricComposition/components/IncomingArrivalProduct/IncomingArrivalProduct.jsx";
import KitTemplates from "./Templates/KitTemplates/KitTemplates.jsx";
import ComponentTemplates from "./Templates/ComponentTemplates/ComponentTemplates.jsx";
import KitSizes from "./Templates/KitSizes/KitSizes.jsx";
import ComponentTypes from "./Templates/ComponentTypes/ComponentTypes.jsx";
import OptionParts from "./Templates/OptionParts/OptionParts.jsx";
import KitOptionTemplates from "./Templates/Options/KitOptions/KitOptionTemplates.jsx";
import ComponentOptions from "./Templates/Options/ComponentOptions/ComponentOptions.jsx";
import PaymentForVendors from "./PaymentForVendors/PaymentForVendors.jsx";
import NewVendorPayment from "./PaymentForVendors/NewVendorPayment/NewVendorPayment.jsx";
import VendorDebtList from "./PaymentForVendors/VendorDebtList/VendorDebtList.jsx";
import VendorManagement from "./PaymentForVendors/VendorManagement/VendorManagement.jsx";
import PrivatPaymentInfo from "./PaymentForOrders/PrivatPaymentInfo/PrivatPaymentInfo.jsx";
import PaymentForCRM from "./PaymentForCRM/PaymentForCRM.jsx";
import CRMPaymentInfo from "./PaymentForCRM/CRMPaymentInfo/CRMPaymentInfo.jsx";
import { useAppSelector } from "../hooks/redux";
import { getProfile } from "../store/selectors";



const Authorized = () => {
    const { groups } = useAppSelector(getProfile);

    const userGroups = Array.isArray(groups) ? groups : [];

    const isCutter = userGroups.includes("Закрійник");
    const isSewer = userGroups.includes("Швачка") || userGroups.includes("Швея");
    const isPacker = userGroups.includes("Пакувальник");

    const isAccountant = userGroups.includes("Бухгалтер");

    const isProductionWorker = isCutter || isSewer || isPacker;

    const startPage = isProductionWorker
        ? "/orders"
        : isAccountant
            ? "/payment-for-orders"
            : "/storage";


    const GuardActivator = () => { useUnsavedChangesGuard(); return null; };
    return (
        <UnsavedChangesProvider>
            <GuardActivator/>
            <div className={'wrapper'}>
                <Navigation/>
                <div className={'contentBox'}>
                    <Routes>
                        <Route path={'/'} element={<Navigate to={startPage} replace />} />
                        <Route path={'/storage'} element={<FabricComposition/>}/>
                        <Route path={'/storage-product'} element={<StorageProduct/>}/>
                        <Route path={'/order'} element={<Order/>}/>
                        <Route path={'/orders'} element={<Orders/>}/>
                        <Route path={'/payment-for-orders'} element={<PaymentForOrders/>}/>
                        <Route path={'/privatPaymentInfo/:id'} element={<PrivatPaymentInfo />} />
                        <Route path={'/finances'} element={<Finances/>}/>
                        <Route path={'/financesCreate'} element={<FinancesCreate/>}/>
                        <Route path={'/incomingArrivalFabric'} element={<IncomingArrivalFabric key="new" />} />
                        <Route path={'/incomingArrivalFabric/:id'} element={<IncomingArrivalFabric key="edit" />} />
                        <Route path={'/incomingArrivalFabric/:id/read'} element={<IncomingArrivalFabric key="read" />} />
                        <Route path={'/incomingArrivalProduct'} element={<IncomingArrivalProduct key="new" />} />
                        <Route path={'/incomingArrivalProduct/:id'} element={<IncomingArrivalProduct key="edit" />} />
                        <Route path={'/incomingArrivalProduct/:id/read'} element={<IncomingArrivalProduct key="read" />} />
                        <Route path={'/newFabric'} element={<NewFabric/>}/>
                        <Route path={'/newProduct'} element={<NewProduct/>}/>
                        <Route path={'/arrivalList'} element={<ArrivalList/>}/>
                        <Route path={'/bills'} element={<Bills/>}/>
                        <Route path={'/newPrices'} element={<NewPrices/>}/>
                        <Route path={'/pricelist'} element={<Pricelist/>}/>
                        <Route path={'/sources'} element={<Sources/>}/>
                        <Route path={'/kitTemplates'} element={<KitTemplates/>}/>
                        <Route path={'/componentTemplates'} element={<ComponentTemplates/>}/>
                        <Route path={'/componentTypes'} element={<ComponentTypes/>}/>
                        <Route path={'/kitSizes'} element={<KitSizes/>}/>
                        <Route path={'/componentOptions'} element={<ComponentOptions/>}/>
                        <Route path={'/kitOptions'} element={<KitOptionTemplates/>}/>
                        <Route path={'/optionParts'} element={<OptionParts/>}/>
                        <Route path={'/payment-for-vendors'} element={<PaymentForVendors/>}/>
                        <Route path={'/new-vendor-payment'} element={<NewVendorPayment key="new" />} />
                        <Route path={'/new-vendor-payment/:id'} element={<NewVendorPayment key="edit" />} />
                        <Route path={'/new-vendor-payment/:id/read'} element={<NewVendorPayment key="read" />} />
                        <Route path={'/vendorList'} element={<VendorDebtList />} />
                        <Route path={'/vendorManagement'} element={<VendorManagement />} />
                        <Route path={'/payment-for-crm'} element={<PaymentForCRM />} />
                        <Route path={'/crm-payment-info/:id'} element={<CRMPaymentInfo />} />
                    </Routes>
                </div>
            </div>
        </UnsavedChangesProvider>
    )
}

export default Authorized;