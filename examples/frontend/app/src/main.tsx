import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import CliLogin from './CliLogin.tsx';

// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed in index.html
createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<App />} />
				<Route path="/cli-login" element={<CliLogin />} />
			</Routes>
		</BrowserRouter>
	</StrictMode>,
);
