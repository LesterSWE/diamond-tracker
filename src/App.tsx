import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Team from './pages/Team';
import Game from './pages/Game';
import SeasonStats from './pages/SeasonStats';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/team/:teamId" element={<Team />} />
        <Route path="/team/:teamId/stats" element={<SeasonStats />} />
        <Route path="/game/:gameId" element={<Game />} />
      </Routes>
    </BrowserRouter>
  );
}
