'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dice1, Dice2, Dice3, Dice4, Dice5, Dice6,
  ChevronLeft, History, ShieldCheck, Volume2, VolumeX,
  Minus, Plus, RotateCcw, Trophy, Target, Users, Zap,
  Home, Flag, Info, TrendingUp, Play,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LudoPiece {
  id: number;
  player: 'purple' | 'red';
  position: number;
  isFinished: boolean;
  isInBase: boolean;
}

interface LudoApiResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    action: 'roll' | 'move';
    diceValue?: number;
    pieceId?: number;
    newPosition?: number;
    captured?: boolean;
    capturedPieceId?: number;
    isWin: boolean;
    gameOver: boolean;
    winner?: 'purple' | 'red';
    botAction?: { pieceId: number; diceValue: number; newPosition: number; };
    playerPieces: { id: number; position: number; isFinished: boolean; isInBase: boolean }[];
    botPieces: { id: number; position: number; isFinished: boolean; isInBase: boolean }[];
  };
  fairness: { serverSeedHash: string; clientSeed: string; nonce: number; };
  newBalance: number;
}

interface GameRound {
  id: string; won: boolean; betAmount: number; payout: number; profit: number; multiplier: number; timestamp: Date;
  fairness?: { serverSeedHash: string; clientSeed: string; nonce: number; };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'LTC', 'DOGE', 'XRP', 'TRX'];
const BOARD_SIZE = 15;
const TOTAL_PATH_LENGTH = 52;

const DiceFaces: Record<number, React.ComponentType<{ className?: string }>> = {
  1: Dice1, 2: Dice2, 3: Dice3, 4: Dice4, 5: Dice5, 6: Dice6,
};

type CellType = 'empty' | 'path' | 'purple-home' | 'red-home' | 'purple-base' | 'red-base' | 'green-base' | 'yellow-base' | 'green-home' | 'yellow-home' | 'center';

function getCellType(row: number, col: number): CellType {
  if (row >= 6 && row <= 8 && col >= 6 && col <= 8) return 'center';
  if (col >= 6 && col <= 8 && row >= 0 && row <= 5) { if (col === 7 && row >= 1 && row <= 5) return 'red-home'; return 'path'; }
  if (col >= 6 && col <= 8 && row >= 9 && row <= 14) { if (col === 7 && row >= 9 && row <= 13) return 'purple-home'; return 'path'; }
  if (row >= 6 && row <= 8 && col >= 0 && col <= 5) { if (row === 7 && col >= 1 && col <= 5) return 'green-home'; return 'path'; }
  if (row >= 6 && row <= 8 && col >= 9 && col <= 14) { if (row === 7 && col >= 9 && col <= 13) return 'yellow-home'; return 'path'; }
  if (row >= 0 && row <= 5 && col >= 0 && col <= 5) return 'green-base';
  if (row >= 0 && row <= 5 && col >= 9 && col <= 14) return 'red-base';
  if (row >= 9 && row <= 14 && col >= 0 && col <= 5) return 'yellow-base';
  if (row >= 9 && row <= 14 && col >= 9 && col <= 14) return 'purple-base';
  return 'empty';
}

function positionToGrid(position: number, player: 'purple' | 'red'): { row: number; col: number } | null {
  const pathCells: { row: number; col: number }[] = [
    {row:13,col:8},{row:12,col:8},{row:11,col:8},{row:10,col:8},{row:9,col:8},{row:8,col:9},{row:8,col:10},{row:8,col:11},{row:8,col:12},{row:8,col:13},{row:8,col:14},{row:7,col:14},{row:6,col:14},{row:6,col:13},{row:6,col:12},{row:6,col:11},{row:6,col:10},{row:6,col:9},{row:5,col:8},{row:4,col:8},{row:3,col:8},{row:2,col:8},{row:1,col:8},{row:0,col:8},{row:0,col:7},{row:0,col:6},{row:1,col:6},{row:2,col:6},{row:3,col:6},{row:4,col:6},{row:5,col:6},{row:6,col:5},{row:6,col:4},{row:6,col:3},{row:6,col:2},{row:6,col:1},{row:6,col:0},{row:7,col:0},{row:8,col:0},{row:8,col:1},{row:8,col:2},{row:8,col:3},{row:8,col:4},{row:8,col:5},{row:9,col:6},{row:10,col:6},{row:11,col:6},{row:12,col:6},{row:13,col:6},{row:14,col:6},{row:14,col:7},{row:14,col:8},
  ];
  const purpleHomeStretch = [{row:13,col:7},{row:12,col:7},{row:11,col:7},{row:10,col:7},{row:9,col:7}];
  const redHomeStretch = [{row:1,col:7},{row:2,col:7},{row:3,col:7},{row:4,col:7},{row:5,col:7}];
  if (position >= 52 && position <= 56) { const homeIdx = position - 52; const stretch = player === 'purple' ? purpleHomeStretch : redHomeStretch; return stretch[homeIdx] || null; }
  if (position === 57) { return player === 'purple' ? {row:8,col:7} : {row:6,col:7}; }
  if (position < 0 || position >= pathCells.length) return null;
  const offset = player === 'purple' ? 0 : 26;
  const actualPos = (position + offset) % TOTAL_PATH_LENGTH;
  return pathCells[actualPos] || null;
}

function getBasePosition(player: 'purple' | 'red', pieceIndex: number): { row: number; col: number } {
  const purpleBases = [{row:10,col:10},{row:10,col:12},{row:12,col:10},{row:12,col:12}];
  const redBases = [{row:1,col:10},{row:1,col:12},{row:3,col:10},{row:3,col:12}];
  const bases = player === 'purple' ? purpleBases : redBases;
  return bases[pieceIndex] || bases[0];
}

function StarIcon({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>);
}

function DiceRoll3D({ value, rolling }: { value: number; rolling: boolean }) {
  const DiceFace = DiceFaces[value] || Dice1;
  return (
    <div className="relative w-20 h-20 sm:w-24 sm:h-24" style={{ perspective: '600px' }}>
      <motion.div className={cn('w-full h-full rounded-2xl flex items-center justify-center', 'bg-gradient-to-br from-white to-gray-200 shadow-xl', 'border-2 border-gray-300')} style={{ transformStyle: 'preserve-3d' }}
        animate={rolling ? { rotateX: [0,360,720,1080], rotateY: [0,180,540,720], rotateZ: [0,90,270,360], scale: [1,0.8,1.1,1] } : { rotateX:0, rotateY:0, rotateZ:0, scale:1 }}
        transition={rolling ? { duration: 0.8, ease: 'easeOut' } : { type: 'spring', stiffness: 300, damping: 20 }}>
        <DiceFace className="w-12 h-12 sm:w-14 sm:h-14 text-[#0D1117]" />
      </motion.div>
      <motion.div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-3 bg-black/20 rounded-full blur-sm"
        animate={rolling ? { scale: [1,0.6,1.2,1], opacity: [0.3,0.1,0.4,0.3] } : {}} transition={rolling ? { duration: 0.8 } : {}} />
    </div>
  );
}

function PieceToken({ player, count, selected, onClick, canSelect }: { player: 'purple' | 'red'; count: number; selected?: boolean; onClick?: () => void; canSelect?: boolean }) {
  const colors = { purple: { bg: '#8B5CF6', ring: '#A78BFA', shadow: 'rgba(139,92,246,0.4)' }, red: { bg: '#EF4444', ring: '#FCA5A5', shadow: 'rgba(239,68,68,0.4)' } };
  const c = colors[player];
  return (
    <motion.div className={cn('w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white cursor-pointer relative', canSelect && 'ring-2 ring-offset-1 ring-offset-[#0D1117]', selected && 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-[#0D1117]')} style={{ backgroundColor: c.bg, boxShadow: `0 2px 8px ${c.shadow}` }} onClick={onClick} whileHover={canSelect ? { scale: 1.2 } : {}} whileTap={canSelect ? { scale: 0.9 } : {}} animate={canSelect ? { y: [0,-3,0], scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] } : {}} transition={canSelect ? { duration: 0.8, repeat: Infinity } : {}}>
      {count > 1 && <span>{count}</span>}
      <div className="absolute top-0.5 left-1 w-2 h-1.5 rounded-full bg-white/30" />
    </motion.div>
  );
}

function BoardCell({ row, col, cellType, pieces, selectedPiece, onPieceClick, canSelectPieces }: { row: number; col: number; cellType: CellType; pieces: { player: 'purple' | 'red'; ids: number[] }[]; selectedPiece: number | null; onPieceClick: (pieceId: number) => void; canSelectPieces: boolean }) {
  const bgColors: Record<CellType, string> = { empty: 'bg-transparent', path: 'bg-[#1C2128] border border-gray-700/50', 'purple-home': 'bg-purple-500/20 border border-purple-500/30', 'red-home': 'bg-red-500/20 border border-red-500/30', 'purple-base': 'bg-purple-900/30', 'red-base': 'bg-red-900/30', 'green-base': 'bg-emerald-900/30', 'yellow-base': 'bg-yellow-900/30', 'green-home': 'bg-emerald-500/20 border border-emerald-500/30', 'yellow-home': 'bg-yellow-500/20 border border-yellow-500/30', center: 'bg-gradient-to-br from-purple-500/20 via-[#1C2128] to-red-500/20 border border-gray-600/50' };
  const isPathLike = ['path','purple-home','red-home','green-home','yellow-home','center'].includes(cellType);
  if (cellType === 'empty') return <div className="w-full h-full" />;
  const isSafe = (row===8&&col===1)||(row===1&&col===6)||(row===6&&col===13)||(row===13&&col===8);
  return (
    <div className={cn('w-full h-full rounded-sm flex items-center justify-center relative transition-colors', bgColors[cellType], isSafe && isPathLike && 'border-yellow-500/40')}>
      {isSafe && isPathLike && (<div className="absolute inset-0 flex items-center justify-center opacity-20"><StarIcon className="w-3 h-3 text-yellow-400" /></div>)}
      <div className="flex flex-wrap gap-0.5 items-center justify-center">
        {pieces.map((group) => (<PieceToken key={`${group.player}-${group.ids.join(',')}`} player={group.player} count={group.ids.length} selected={group.ids.some((id) => id === selectedPiece)} canSelect={canSelectPieces && group.player === 'purple'} onClick={() => { if (canSelectPieces && group.player === 'purple' && group.ids[0] !== undefined) { onPieceClick(group.ids[0]); } }} />))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LudoPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [currency, setCurrency] = useState('USDT');
  const [betAmount, setBetAmount] = useState('1.00');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'purple' | 'red' | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [diceValue, setDiceValue] = useState(1);
  const [currentTurn, setCurrentTurn] = useState<'purple' | 'red'>('purple');
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);
  const [needsMove, setNeedsMove] = useState(false);
  const [movablePieces, setMovablePieces] = useState<number[]>([]);
  const [lastCapture, setLastCapture] = useState(false);
  const [message, setMessage] = useState('Roll the dice to start!');
  const [error, setError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [playerPieces, setPlayerPieces] = useState<LudoPiece[]>([
    {id:0,player:'purple',position:-1,isFinished:false,isInBase:true},{id:1,player:'purple',position:-1,isFinished:false,isInBase:true},{id:2,player:'purple',position:-1,isFinished:false,isInBase:true},{id:3,player:'purple',position:-1,isFinished:false,isInBase:true},
  ]);
  const [botPieces, setBotPieces] = useState<LudoPiece[]>([
    {id:0,player:'red',position:-1,isFinished:false,isInBase:true},{id:1,player:'red',position:-1,isFinished:false,isInBase:true},{id:2,player:'red',position:-1,isFinished:false,isInBase:true},{id:3,player:'red',position:-1,isFinished:false,isInBase:true},
  ]);

  const [showFairness, setShowFairness] = useState(false);
  const [selectedCurrencyOpen, setSelectedCurrencyOpen] = useState(false);
  const [history, setHistory] = useState<GameRound[]>([]);
  const [lastFairness, setLastFairness] = useState<{serverSeedHash:string;clientSeed:string;nonce:number}|null>(null);
  const [stats, setStats] = useState({wins:0,losses:0,totalRolls:0,piecesHome:0,captures:0,sixes:0});

  const getBalance = useCallback(() => { if (!user?.balances) return 0; const bal = user.balances.find((b) => b.currency === currency); return bal?.available ?? 0; }, [user, currency]);

  const adjustBet = useCallback((direction: 'up' | 'down') => {
    const steps = [0.10,0.25,0.50,1.00,2.50,5.00,10.00,25.00,50.00,100.00];
    const current = parseFloat(betAmount); const idx = steps.findIndex((s) => s >= current);
    if (direction === 'up' && idx < steps.length - 1) setBetAmount(steps[idx + 1].toFixed(2));
    else if (direction === 'down' && idx > 0) setBetAmount(steps[Math.max(0, idx - 1)].toFixed(2));
  }, [betAmount]);

  const resetPieces = useCallback(() => {
    setPlayerPieces([{id:0,player:'purple',position:-1,isFinished:false,isInBase:true},{id:1,player:'purple',position:-1,isFinished:false,isInBase:true},{id:2,player:'purple',position:-1,isFinished:false,isInBase:true},{id:3,player:'purple',position:-1,isFinished:false,isInBase:true}]);
    setBotPieces([{id:0,player:'red',position:-1,isFinished:false,isInBase:true},{id:1,player:'red',position:-1,isFinished:false,isInBase:true},{id:2,player:'red',position:-1,isFinished:false,isInBase:true},{id:3,player:'red',position:-1,isFinished:false,isInBase:true}]);
  }, []);

  const startGame = useCallback(() => {
    if (!isAuthenticated) { setError('Please log in to play'); return; }
    const bet = parseFloat(betAmount); if (isNaN(bet)||bet<=0) { setError('Invalid bet amount'); return; }
    if (bet > getBalance()) { setError('Insufficient balance'); return; }
    setError(''); setGameStarted(true); setGameOver(false); setWinner(null); setCurrentTurn('purple');
    setNeedsMove(false); setSelectedPiece(null); setMovablePieces([]); setLastCapture(false);
    setMessage('Your turn! Roll the dice.'); setDiceValue(1); resetPieces();
  }, [isAuthenticated, betAmount, getBalance, resetPieces]);

  const executeBotTurn = useCallback((data: LudoApiResponse) => {
    setCurrentTurn('red'); setMessage("Bot's turn...");
    setTimeout(() => {
      if (data.result.botAction) {
        setDiceValue(data.result.botAction.diceValue);
        setStats((s) => ({...s,totalRolls:s.totalRolls+1,sixes:data.result.botAction!.diceValue===6?s.sixes+1:s.sixes}));
        setIsRolling(true);
        setTimeout(() => {
          setIsRolling(false);
          if (data.result.botPieces) setBotPieces(data.result.botPieces.map((p) => ({...p,player:'red' as const})));
          setMessage(`Bot rolled ${data.result.botAction!.diceValue}. Your turn!`); setCurrentTurn('purple');
        }, 900);
      } else { setCurrentTurn('purple'); setMessage('Bot has no moves. Your turn!'); }
    }, 600);
  }, []);

  const movePiece = useCallback(async (pieceId: number, rollData?: LudoApiResponse) => {
    setNeedsMove(false); setSelectedPiece(null); setMovablePieces([]);
    try {
      const data: LudoApiResponse = rollData ? rollData : ((await post<LudoApiResponse>('/casino/games/ludo/play', {amount:parseFloat(betAmount),currency,options:{action:'move',pieceId}})) as LudoApiResponse);
      if (data.result.playerPieces) setPlayerPieces(data.result.playerPieces.map((p) => ({...p,player:'purple' as const})));
      if (data.result.captured) { setLastCapture(true); setStats((s) => ({...s,captures:s.captures+1})); setMessage('Captured an opponent piece!'); setTimeout(() => setLastCapture(false), 2000); }
      const piecesHome = (data.result.playerPieces||[]).filter((p) => p.isFinished).length;
      setStats((s) => ({...s,piecesHome}));
      if (data.result.gameOver) {
        setGameOver(true); const w = data.result.winner || 'red'; setWinner(w);
        if (w === 'purple') { setStats((s) => ({...s,wins:s.wins+1})); setMessage('You win! All pieces home!'); }
        else { setStats((s) => ({...s,losses:s.losses+1})); setMessage('Bot wins! Better luck next time.'); }
        useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
        const betAmt = data.betAmount??parseFloat(betAmount); const mult = data.multiplier??(w==='purple'?2:0);
        const payoutAmt = data.payout??betAmt*mult; const profitAmt = data.profit??(payoutAmt-betAmt);
        const round: GameRound = {id:data.roundId,won:w==='purple',betAmount:betAmt,payout:payoutAmt,profit:profitAmt,multiplier:mult,timestamp:new Date(),fairness:data.fairness};
        setHistory((prev) => [round,...prev].slice(0,50)); return;
      }
      if (diceValue !== 6 && !data.result.captured) { setTimeout(() => executeBotTurn(data), 800); }
      else { setMessage('Bonus turn! Roll again.'); setCurrentTurn('purple'); }
    } catch (err: any) { setError(err?.message || 'Move failed. Please try again.'); }
  }, [betAmount, currency, diceValue, executeBotTurn]);

  const rollDice = useCallback(async () => {
    if (isRolling||needsMove||gameOver||!gameStarted) return;
    if (currentTurn !== 'purple') return;
    setError(''); setIsRolling(true); setLastCapture(false);
    try {
      const data = (await post<LudoApiResponse>('/casino/games/ludo/play', {amount:parseFloat(betAmount),currency,options:{action:'roll'}})) as LudoApiResponse;
      await new Promise((resolve) => setTimeout(resolve, 900));
      const dice = data.result.diceValue || 1; setDiceValue(dice); setIsRolling(false);
      setStats((s) => ({...s,totalRolls:s.totalRolls+1,sixes:dice===6?s.sixes+1:s.sixes}));
      setLastFairness(data.fairness);
      useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
      const canMove: number[] = [];
      playerPieces.forEach((p) => { if (p.isFinished) return; if (p.isInBase && dice===6) canMove.push(p.id); if (!p.isInBase && !p.isFinished) { const newPos = p.position+dice; if (newPos<=57) canMove.push(p.id); } });
      if (canMove.length === 0) { setMessage(dice===6?'Rolled a 6 but no valid moves.':'No valid moves. Bot\'s turn.'); setTimeout(() => executeBotTurn(data), 1200); }
      else if (canMove.length === 1) { setMessage(`Rolled ${dice}! Moving piece...`); setTimeout(() => movePiece(canMove[0], data), 600); }
      else { setMovablePieces(canMove); setNeedsMove(true); setMessage(`Rolled ${dice}! Select a piece to move.`); }
    } catch (err: any) { setIsRolling(false); setError(err?.message || 'Roll failed. Please try again.'); }
  }, [isRolling,needsMove,gameOver,gameStarted,currentTurn,betAmount,currency,playerPieces,executeBotTurn,movePiece]);

  const handlePieceClick = useCallback((pieceId: number) => {
    if (!needsMove) return; if (!movablePieces.includes(pieceId)) return;
    setSelectedPiece(pieceId); movePiece(pieceId);
  }, [needsMove, movablePieces, movePiece]);

  const buildBoard = useCallback(() => {
    const boardGrid: {cellType:CellType;pieces:{player:'purple'|'red';ids:number[]}[];row:number;col:number}[][] = [];
    for (let r = 0; r < BOARD_SIZE; r++) { boardGrid[r] = []; for (let c = 0; c < BOARD_SIZE; c++) { boardGrid[r][c] = {cellType:getCellType(r,c),pieces:[],row:r,col:c}; } }
    const placePiece = (piece: LudoPiece, player: 'purple' | 'red') => {
      let pos: {row:number;col:number}|null = null;
      if (piece.isFinished) pos = player==='purple'?{row:8,col:7}:{row:6,col:7};
      else if (piece.isInBase) pos = getBasePosition(player, piece.id);
      else pos = positionToGrid(piece.position, player);
      if (pos && boardGrid[pos.row] && boardGrid[pos.row][pos.col]) {
        const cell = boardGrid[pos.row][pos.col]; const existing = cell.pieces.find((p) => p.player===player);
        if (existing) existing.ids.push(piece.id); else cell.pieces.push({player,ids:[piece.id]});
      }
    };
    playerPieces.forEach((p) => placePiece(p, 'purple'));
    botPieces.forEach((p) => placePiece(p, 'red'));
    return boardGrid;
  }, [playerPieces, botPieces]);

  const board = buildBoard();

  return (
    <div className="min-h-screen bg-[#0D1117] text-white pb-20">
      {/* Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      {/* Turn indicator and message */}
      <div className="px-4 pt-3">
        <div className="rounded-xl bg-[#161B22] border border-[#30363D] p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div className={cn('w-3 h-3 rounded-full', currentTurn==='purple'?'bg-purple-500':'bg-red-500')} animate={{scale:[1,1.3,1]}} transition={{duration:1,repeat:Infinity}} />
            <span className="text-sm font-medium">{currentTurn==='purple'?<span className="text-purple-400">Your Turn</span>:<span className="text-red-400">Bot&apos;s Turn</span>}</span>
          </div>
          <motion.span className="text-sm text-[#8B949E] max-w-[200px] truncate" key={message} initial={{opacity:0,y:-5}} animate={{opacity:1,y:0}}>{message}</motion.span>
        </div>
      </div>

      {/* Board - edge to edge */}
      <div className="flex flex-col items-center gap-4 py-4">
        <motion.div className="rounded-2xl bg-[#161B22] border border-[#30363D] p-2 sm:p-3 relative overflow-hidden" initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}>
          <div className="grid gap-px" style={{gridTemplateColumns:`repeat(${BOARD_SIZE}, minmax(0, 1fr))`,gridTemplateRows:`repeat(${BOARD_SIZE}, minmax(0, 1fr))`,width:'min(78vw, 460px)',height:'min(78vw, 460px)'}}>
            {board.map((row, r) => row.map((cell, c) => (
              <BoardCell key={`${r}-${c}`} row={r} col={c} cellType={cell.cellType} pieces={cell.pieces} selectedPiece={selectedPiece} onPieceClick={handlePieceClick} canSelectPieces={needsMove && currentTurn==='purple'} />
            )))}
          </div>
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 w-[38%] h-[38%] rounded-xl border-2 border-emerald-500/20 pointer-events-none" />
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 w-[38%] h-[38%] rounded-xl border-2 border-red-500/20 pointer-events-none" />
          <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 w-[38%] h-[38%] rounded-xl border-2 border-yellow-500/20 pointer-events-none" />
          <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 w-[38%] h-[38%] rounded-xl border-2 border-purple-500/20 pointer-events-none" />

          {/* Game over overlay */}
          <AnimatePresence>
            {gameOver && (
              <motion.div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-2xl z-20" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                <motion.div className="text-center p-6" initial={{scale:0}} animate={{scale:1}} transition={{type:'spring',stiffness:200,damping:15}}>
                  <motion.div className="mb-4" animate={{rotate:[0,-10,10,0]}} transition={{duration:0.5,repeat:2}}>
                    {winner==='purple'?<Trophy className="w-16 h-16 text-yellow-400 mx-auto" />:<Target className="w-16 h-16 text-red-400 mx-auto" />}
                  </motion.div>
                  <div className={cn('text-3xl font-bold mb-2', winner==='purple'?'text-green-400':'text-red-400')}>{winner==='purple'?'You Win!':'Bot Wins!'}</div>
                  {history.length > 0 && <div className="text-lg font-mono text-gray-300">{(history[0].profit??0)>=0?'+':''}{(history[0].profit??0).toFixed(4)} {currency}</div>}
                  <motion.button onClick={startGame} className="mt-4 bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base" whileHover={{scale:1.05}} whileTap={{scale:0.95}}>Play Again</motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Dice and action button */}
        <div className="flex items-center gap-6">
          <DiceRoll3D value={diceValue} rolling={isRolling} />
          {!gameStarted ? (
            <motion.button onClick={startGame} className="bg-[#C8FF00] text-black font-bold py-3.5 px-8 rounded-xl text-base" whileHover={{scale:1.05}} whileTap={{scale:0.95}}>
              <div className="flex items-center gap-2"><Play className="w-5 h-5" />Start Game</div>
            </motion.button>
          ) : (
            <motion.button onClick={rollDice} disabled={isRolling||needsMove||gameOver||currentTurn!=='purple'}
              className={cn('px-8 py-3.5 rounded-xl font-bold text-base flex items-center gap-2 transition-all', isRolling||needsMove||gameOver||currentTurn!=='purple' ? 'bg-[#2D333B] text-white cursor-not-allowed' : 'bg-[#C8FF00] text-black')}
              whileHover={!(isRolling||needsMove||gameOver||currentTurn!=='purple')?{scale:1.05}:{}} whileTap={!(isRolling||needsMove||gameOver||currentTurn!=='purple')?{scale:0.95}:{}}>
              {isRolling?<><motion.div animate={{rotate:360}} transition={{duration:0.6,repeat:Infinity,ease:'linear'}}><RotateCcw className="w-5 h-5" /></motion.div>Rolling...</>:needsMove?<><Target className="w-5 h-5" />Select Piece</>:<><Zap className="w-5 h-5" />ROLL</>}
            </motion.button>
          )}
        </div>

        {/* Capture notification */}
        <AnimatePresence>
          {lastCapture && (<motion.div className="px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm font-bold" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>Piece captured! Bonus turn!</motion.div>)}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="px-4 space-y-3">
        {/* Bet controls (shown before game starts) */}
        {!gameStarted && (
          <>
            {/* Bet Amount */}
            <div>
              <label className="block text-[#8B949E] text-sm mb-1">Bet Amount</label>
              <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
                <span className="text-[#8B949E] text-xs mr-2">{currency}</span>
                <input type="text" value={betAmount} onChange={(e) => setBetAmount(e.target.value)}
                  className="flex-1 bg-transparent text-center text-white font-mono text-sm focus:outline-none" />
                <div className="flex items-center gap-1 ml-2">
                  <button onClick={() => adjustBet('down')} className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white text-sm font-bold"><Minus className="w-3.5 h-3.5" /></button>
                  <button onClick={() => adjustBet('up')} className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white text-sm font-bold"><Plus className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="flex gap-1.5 mt-2">
                {['0.01', '0.1', '1', '10', '100'].map(v => (
                  <button key={v} onClick={() => setBetAmount(v)} className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E]">{v}</button>
                ))}
                <button onClick={() => setBetAmount(Math.max(0.1, parseFloat(betAmount) / 2).toFixed(2))} className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E]">1/2</button>
                <button onClick={() => setBetAmount((parseFloat(betAmount) * 2).toFixed(2))} className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E]">2X</button>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (<motion.div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm" initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}>{error}</motion.div>)}
            </AnimatePresence>
          </>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[{label:'Wins',value:stats.wins,color:'text-[#10B981]'},{label:'Losses',value:stats.losses,color:'text-[#EF4444]'},{label:'Rolls',value:stats.totalRolls,color:'text-white'}].map(s=>(
            <div key={s.label} className="bg-[#161B22] rounded-lg border border-[#30363D] p-2 text-center">
              <div className="text-[10px] text-[#8B949E] uppercase">{s.label}</div>
              <div className={cn('text-sm font-mono font-bold',s.color)}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="bg-[#161B22] rounded-xl border border-[#30363D] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#30363D]"><h3 className="text-sm font-semibold text-white">Game History</h3></div>
            <div className="divide-y divide-[#30363D]/50 max-h-[200px] overflow-y-auto">
              {history.slice(0,10).map((round) => (
                <div key={round.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold', round.won?'bg-[#10B981]/20 text-[#10B981]':'bg-[#EF4444]/20 text-[#EF4444]')}>{round.won?'W':'L'}</div>
                    <div className="text-xs text-[#8B949E] font-mono">{(round.multiplier??0).toFixed(2)}x</div>
                  </div>
                  <div className={cn('text-sm font-mono font-bold', (round.profit??0)>=0?'text-[#10B981]':'text-[#EF4444]')}>{(round.profit??0)>=0?'+':''}{(round.profit??0).toFixed(4)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <a href="/casino" className="text-[#8B949E]">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /></svg>
          </a>
          <button className="text-[#8B949E]">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" /></svg>
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-[#8B949E]">
            {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>
        <span className="text-sm font-mono text-white">{getBalance().toFixed(4)} {currency}</span>
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1 text-xs text-[#8B5CF6]">
          Provably Fair Game
        </div>
      </div>
    </div>
  );
}
