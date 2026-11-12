import React from 'react';
import ReactDOM from 'react-dom/client';
import {Provider} from 'react-redux';
import App from './App';
import {BrowserRouter} from "react-router-dom"

import {store} from './store/store';
import {startMockBackend} from './mocks/browser';
import {startVersionCheck} from './utils/versionCheck';

// Demo build: a tab running an outdated bundle reloads to the deployed one (src/utils/versionCheck.js)
startVersionCheck();

// Demo mode: the mock backend must be running before the app's first request (session check in App.jsx)
startMockBackend()
    .catch((error) => console.error('Mock backend failed to start:', error))
    .then(() => {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(
            <BrowserRouter basename={import.meta.env.BASE_URL}>
                <Provider store={store}>
                    <App/>
                </Provider>
            </BrowserRouter>
        );
    });

