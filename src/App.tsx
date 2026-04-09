import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Team from './pages/Team';
import Game from './pages/Game';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/team/:teamId" element={<Team />} />
        <Route path="/game/:gameId" element={<Game />} />
      </Routes>
    </BrowserRouter>
  );
}
