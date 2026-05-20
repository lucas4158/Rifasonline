import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { 
  Smartphone, 
  CheckCircle2, 
  Clock, 
  Users, 
  Search, 
  Filter, 
  Copy, 
  User, 
  MessageCircle, 
  ShieldCheck, 
  TrendingUp,
  X,
  CreditCard,
  QrCode,
  Trophy,
  PartyPopper,
  Trash2,
  RefreshCw,
  Unlock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, collection, onSnapshot, setDoc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

type Status = 'available' | 'paid' | 'reserved' | 'selected';

interface NumberItem {
  id: string;
  status: Status;
}

export default function RifaOnlineDemo() {
  // Admin & Auth State
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawCountdown, setDrawCountdown] = useState(0);
  const [drawScrambled, setDrawScrambled] = useState('000');
  
  // Raffle Configuration State
  const [raffleConfig, setRaffleConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('raffle_config_v1');
      return saved ? JSON.parse(saved) : {
        title: 'iPhone 15 Pro Max',
        description: 'Smartphone topo de linha de última geração com câmera teleobjetiva de 5x, acabamento em titânio e tela Super Retina XDR espetacular.',
        price: 10,
        totalNumbers: 150,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=600',
        pixKey: '73.492.381/0001-92',
        pixReceiver: 'Rifas Premium Ltda.',
        pixBank: 'Nubank SA',
        pixPhone: '5511999999999',
        winnerNumber: '',
        winnerName: ''
      };
    } catch {
      return {
        title: 'iPhone 15 Pro Max',
        description: 'Smartphone topo de linha de última geração com câmera teleobjetiva de 5x, acabamento em titânio e tela Super Retina XDR espetacular.',
        price: 10,
        totalNumbers: 150,
        isActive: true,
        imageUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=600',
        pixKey: '73.492.381/0001-92',
        pixReceiver: 'Rifas Premium Ltda.',
        pixBank: 'Nubank SA',
        pixPhone: '5511999999999',
        winnerNumber: '',
        winnerName: ''
      };
    }
  });

  // Admin Config Editing State
  const [editedConfig, setEditedConfig] = useState(raffleConfig);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // Orders State (Empty initially)
  const [orders, setOrders] = useState<{ id: string; name: string; phone: string; nums: string[]; val: number; status: 'Aguardando' | 'Pago' | 'Cancelado' }[]>(() => {
    try {
      const saved = localStorage.getItem('raffle_orders_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Keep editedConfig in sync with incoming database raffleConfig changes
  useEffect(() => {
    setEditedConfig(raffleConfig);
  }, [raffleConfig]);

  // Real-time Firestore Sync for Config
  useEffect(() => {
    const docRef = doc(db, 'raffle', 'config');
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRaffleConfig(data as any);
      } else {
        // Initialize default config in Firestore if it doesn't exist
        const defaultConfig = {
          title: 'iPhone 15 Pro Max',
          description: 'Smartphone topo de linha de última geração com câmera teleobjetiva de 5x, acabamento em titânio e tela Super Retina XDR espetacular.',
          price: 10,
          totalNumbers: 150,
          isActive: true,
          imageUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=600',
          pixKey: '73.492.381/0001-92',
          pixReceiver: 'Rifas Premium Ltda.',
          pixBank: 'Nubank SA',
          pixPhone: '5511999999999',
          winnerNumber: '',
          winnerName: ''
        };
        setDoc(docRef, defaultConfig).catch((err) => console.error('Error init config:', err));
        setRaffleConfig(defaultConfig);
      }
      setIsConfigLoaded(true);
    }, (error) => {
      console.error('Error fetching raffle config in real-time:', error);
      setIsConfigLoaded(true); // Fallback to local storage State
    });

    return () => unsub();
  }, []);

  // Real-time Firestore Sync for Orders
  useEffect(() => {
    const colRef = collection(db, 'orders');
    const unsub = onSnapshot(colRef, (querySnap) => {
      const ordersList: any[] = [];
      querySnap.forEach((doc) => {
        ordersList.push({ id: doc.id, ...doc.data() });
      });
      // Sort orders descending with key timestamp or fallback ID
      ordersList.sort((a, b) => {
        const tA = a.createdAt || '';
        const tB = b.createdAt || '';
        if (tA && tB) {
          return tB.localeCompare(tA);
        }
        return b.id.localeCompare(a.id);
      });
      setOrders(ordersList);
    });

    return () => unsub();
  }, []);

  // Persist LocalStorage Fallbacks
  useEffect(() => {
    try {
      localStorage.setItem('raffle_config_v1', JSON.stringify(raffleConfig));
    } catch (e) {
      console.error('Failed to save raffle config:', e);
    }
  }, [raffleConfig]);

  useEffect(() => {
    try {
      localStorage.setItem('raffle_orders_v1', JSON.stringify(orders));
    } catch (e) {
      console.error('Failed to save orders:', e);
    }
  }, [orders]);

  // Session ID for locking numbers temporarily
  const sessionId = useMemo(() => {
    let id = localStorage.getItem('raffle_session_id_v2');
    if (!id) {
      id = 'sess_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('raffle_session_id_v2', id);
    }
    return id;
  }, []);

  const [now, setNow] = useState(Date.now());
  const [locks, setLocks] = useState<{ [numberId: string]: { sessionId: string; expiresAt: number } }>({});

  // Dynamic continuous clock to evaluate lock expirations instantly in real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Firestore Sync for Locks
  useEffect(() => {
    const colRef = collection(db, 'locks');
    const unsub = onSnapshot(colRef, (querySnap) => {
      const activeLocks: { [numberId: string]: { sessionId: string; expiresAt: number } } = {};
      const currentNow = Date.now();
      querySnap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data && data.expiresAt > currentNow) {
          activeLocks[docSnap.id] = {
            sessionId: data.sessionId,
            expiresAt: data.expiresAt
          };
        }
      });
      setLocks(activeLocks);
    });

    return () => unsub();
  }, []);

  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);

  // Keep selectedNumbers in sync with locks from our sessionId
  useEffect(() => {
    const myLockedNums = (Object.entries(locks) as [string, { sessionId: string; expiresAt: number }][])
      .filter(([_, l]) => l.sessionId === sessionId && l.expiresAt > now)
      .map(([numId]) => numId);
    
    // Sort to compare strings and avoid infinite loops
    const currentStr = [...selectedNumbers].sort().join(',');
    const newStr = [...myLockedNums].sort().join(',');
    if (currentStr !== newStr) {
      setSelectedNumbers(myLockedNums);
    }
  }, [locks, sessionId, now]);

  const clearMyLocks = async (numsToClear?: string[]) => {
    const targets = numsToClear || selectedNumbers;
    if (targets.length === 0) return;
    try {
      const promises = targets.map(numId => deleteDoc(doc(db, 'locks', numId)));
      await Promise.all(promises);
    } catch (err) {
      console.error('Error clearing locks:', err);
    }
  };
  // Dynamically calculate timerInSeconds based on expiration of our active locks
  const timerInSeconds = useMemo(() => {
    const myLocks = (Object.entries(locks) as [string, { sessionId: string; expiresAt: number }][])
      .filter(([_, l]) => l.sessionId === sessionId && l.expiresAt > now);
    if (myLocks.length === 0) return 180;
    const minExpiresAt = Math.min(...myLocks.map(([_, l]) => l.expiresAt));
    const secondsLeft = Math.ceil((minExpiresAt - now) / 1000);
    return Math.max(0, secondsLeft);
  }, [locks, sessionId, now]);

  // Auto-cleanup expired locks in Firestore (runs on any client to clean obsolete records)
  useEffect(() => {
    const expiredLocks = (Object.entries(locks) as [string, { sessionId: string; expiresAt: number }][])
      .filter(([_, l]) => l.expiresAt <= now);
    
    if (expiredLocks.length > 0) {
      expiredLocks.forEach(([numId]) => {
        deleteDoc(doc(db, 'locks', numId)).catch(err => console.error('Error cleaning up lock:', err));
      });
    }
  }, [locks, now]);

  const [searchTerm, setSearchTerm] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [openReleaseOrderId, setOpenReleaseOrderId] = useState<string | null>(null);
  const [filter, setFilter] = useState('Todos');
  const [paymentStep, setPaymentStep] = useState<'data' | 'pix' | 'finished'>('data');
  const [submittedNumbers, setSubmittedNumbers] = useState<string[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  // Reservation States
  const [isGeneratingPayment, setIsGeneratingPayment] = useState(false);
  const [mpPaymentInfo, setMpPaymentInfo] = useState<{ orderId: string; paymentId: string; qrCode: string; qrCodeBase64: string; isSimulated: boolean } | null>(null);
  const [mpError, setMpError] = useState<string | null>(null);

  const handleCreateMercadoPagoPayment = async () => {
    if (!userData.name || !userData.phone) return;
    setIsGeneratingPayment(true);
    setMpError(null);
    try {
      // Create random uppercase alphanumeric 5-character order ID
      const orderId = Math.random().toString(36).substring(2, 7).toUpperCase();
      const generatedPaymentId = "MAN_" + Math.random().toString(36).substring(2, 10).toUpperCase();

      const newOrder = {
        name: userData.name,
        phone: userData.phone,
        nums: selectedNumbers,
        val: totalAmount,
        status: "Aguardando",
        createdAt: new Date().toISOString(),
        paymentId: generatedPaymentId,
        paymentType: "ManualPix",
        qrCode: raffleConfig.pixKey || "",
        qrCodeBase64: ""
      };

      // Create document in Firestore
      await setDoc(doc(db, "orders", orderId), newOrder);

      // Clean temporary selection locks in Firestore
      try {
        const lockPromises = selectedNumbers.map(numId => deleteDoc(doc(db, 'locks', numId)));
        await Promise.all(lockPromises);
      } catch (e) {
        console.error("Failed to clean locks during reservation:", e);
      }

      setMpPaymentInfo({
        orderId,
        paymentId: generatedPaymentId,
        qrCode: raffleConfig.pixKey || "",
        qrCodeBase64: "",
        isSimulated: false
      });

      setSubmittedNumbers([...selectedNumbers]);
      setSelectedNumbers([]); // clear selection locally
      setPaymentStep('pix');
    } catch (err: any) {
      console.error('Error creating manual reservation order:', err);
      setMpError(err.message || 'Ocorreu um erro ao criar a reserva do Pix. Tente novamente.');
    } finally {
      setIsGeneratingPayment(false);
    }
  };

  // Real-time status sync via synced Orders array (Firestore updates)
  useEffect(() => {
    if (paymentStep === 'pix' && mpPaymentInfo?.orderId) {
      const myOrder = orders.find(o => o.id === mpPaymentInfo.orderId);
      if (myOrder && myOrder.status === 'Pago') {
        setPaymentStep('finished');
      }
    }
  }, [orders, paymentStep, mpPaymentInfo]);
  const [userData, setUserData] = useState({ name: '', phone: '' });

  useEffect(() => {
    try {
      localStorage.setItem('raffle_user_data_v1', JSON.stringify(userData));
    } catch (err) {
      console.error('Failed to save user data to localStorage:', err);
    }
  }, [userData]);
  const [autoSelectAmount, setAutoSelectAmount] = useState<string>('');
  const [isCheckoutVisible, setIsCheckoutVisible] = useState(false);

  // Random selection logic
  const selectRandomNumbers = async (count: number) => {
    if (!raffleConfig.isActive) return;
    const available = numbers.filter(n => n.status === 'available' && !selectedNumbers.includes(n.id))
      .map(n => n.id);
    
    if (available.length === 0) return;
    
    if (paymentStep === 'finished') {
      setPaymentStep('data');
      setSubmittedNumbers([]);
    }
    
    const shuffled = [...available].sort(() => 0.5 - Math.random());
    const toSelect = shuffled.slice(0, Math.min(count, available.length));
    
    // Add to local state immediately for speed
    setSelectedNumbers(prev => [...prev, ...toSelect]);

    // Save temporary locks to Firestore so they are locked for other users
    // Match the exact remaining duration of the active selection countdown
    const remainingTime = selectedNumbers.length > 0 ? timerInSeconds : 180;
    const expiresAt = Date.now() + remainingTime * 1000;
    try {
      const promises = toSelect.map(numId => 
        setDoc(doc(db, 'locks', numId), { sessionId, expiresAt })
      );
      await Promise.all(promises);
    } catch (err) {
      console.error('Error locking selected lucky numbers:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleAdminLogin = (e: FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin@2026') {
      setIsAdminAuthenticated(true);
      setAdminPassword('');
    } else {
      alert('Senha incorreta!');
    }
  };

  const numbers = useMemo(() => {
    // Determine number status based on orders and active real-time locks
    return Array.from({ length: raffleConfig.totalNumbers }, (_, i) => {
      const num = String(i + 1).padStart(3, '0');
      let status: Status = 'available';

      const foundOrder = orders.find(o => o.nums.includes(num));
      if (foundOrder) {
        if (foundOrder.status === 'Pago') status = 'paid';
        else if (foundOrder.status === 'Aguardando') status = 'reserved';
      } else {
        // If not ordered, check if locked by someone else
        const activeLock = locks[num];
        if (activeLock && activeLock.expiresAt > now && activeLock.sessionId !== sessionId) {
          status = 'reserved'; // Blocked/Locked for other users
        }
      }

      return {
        id: num,
        status,
      };
    });
  }, [raffleConfig.totalNumbers, orders, locks, sessionId, now]);

  const stats = useMemo(() => {
    const paid = orders.filter(o => o.status === 'Pago').reduce((acc, curr) => acc + curr.val, 0);
    const pending = orders.filter(o => o.status === 'Aguardando').reduce((acc, curr) => acc + curr.val, 0);
    const countPaid = numbers.filter(n => n.status === 'paid').length;
    const countReserved = numbers.filter(n => n.status === 'reserved' || selectedNumbers.includes(n.id)).length;

    return {
      arrecadado: paid,
      aEntrar: pending,
      countPaid,
      countReserved,
      countAvailable: Math.max(0, raffleConfig.totalNumbers - countPaid - countReserved)
    };
  }, [orders, numbers, selectedNumbers, raffleConfig.totalNumbers]);

  const isRaffleFullyClosed = useMemo(() => {
    return stats.countAvailable === 0;
  }, [stats.countAvailable]);

  const handleAction = async (orderId: string, action: 'confirm' | 'cancel') => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: action === 'confirm' ? 'Pago' : 'Cancelado'
      });
    } catch (e) {
      console.error('Failed to update order status in Firestore:', e);
    }
  };

  const handleReleaseSingleCota = async (orderId: string, numberToRelease: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    if (!window.confirm(`Você tem certeza que deseja liberar apenas a cota ${numberToRelease} do pedido de ${order.name}?`)) {
      return;
    }

    try {
      const updatedNums = order.nums.filter(n => n !== numberToRelease);
      
      if (updatedNums.length === 0) {
        await updateDoc(doc(db, 'orders', orderId), {
          nums: [],
          val: 0,
          status: 'Cancelado'
        });
        alert(`Como todas as cotas foram liberadas, o pedido de ${order.name} foi cancelado.`);
      } else {
        const price = raffleConfig.price || 10;
        await updateDoc(doc(db, 'orders', orderId), {
          nums: updatedNums,
          val: updatedNums.length * price
        });
        alert(`Cota ${numberToRelease} liberada com sucesso do pedido de ${order.name}!`);
      }

      await deleteDoc(doc(db, 'locks', numberToRelease));
    } catch (err) {
      console.error("Erro ao liberar cota individual:", err);
      alert("Erro ao liberar a cota. Por favor, tente novamente.");
    }
  };

  const filteredOrders = useMemo(() => {
    if (!adminSearch.trim()) return orders;
    const q = adminSearch.toLowerCase().trim();
    return orders.filter(o => 
      o.name.toLowerCase().includes(q) ||
      o.phone.includes(q) ||
      o.id.toLowerCase().includes(q) ||
      o.nums.some(n => n.includes(q))
    );
  }, [orders, adminSearch]);

  const handleClearRaffle = async () => {
    if (!window.confirm("Você tem certeza que deseja REINICIAR TODA A RIFA? Isso apagará todos os pedidos de forma permanente, liberará todos os números reservados ou pagos e resetará o ganhador.")) {
      return;
    }

    try {
      setIsClearing(true);

      // 1. Fetch and delete all orders in Firestore
      const ordersSnap = await getDocs(collection(db, 'orders'));
      if (!ordersSnap.empty) {
        const docsArray = ordersSnap.docs;
        for (let i = 0; i < docsArray.length; i += 100) {
          const chunk = docsArray.slice(i, i + 100);
          const batch = writeBatch(db);
          chunk.forEach((docRef) => {
            batch.delete(docRef.ref);
          });
          await batch.commit();
        }
      }

      // 2. Fetch and delete all locks in Firestore
      const locksSnap = await getDocs(collection(db, 'locks'));
      if (!locksSnap.empty) {
        const docsArray = locksSnap.docs;
        for (let i = 0; i < docsArray.length; i += 100) {
          const chunk = docsArray.slice(i, i + 100);
          const batch = writeBatch(db);
          chunk.forEach((docRef) => {
            batch.delete(docRef.ref);
          });
          await batch.commit();
        }
      }

      // 3. Reset winner fields in Firestore config
      const nextConfig = {
        ...raffleConfig,
        winnerNumber: '',
        winnerName: ''
      };
      await setDoc(doc(db, 'raffle', 'config'), nextConfig);
      
      setEditedConfig(nextConfig);

      // 4. Force reset local states immediately to ensure no leftovers
      setOrders([]);
      setLocks({});
      setSelectedNumbers([]);
      setSubmittedNumbers([]);
      setPaymentStep('data');
      setUserData({ name: '', phone: '' });
      setMpPaymentInfo(null);
      setMpError(null);
      setAutoSelectAmount('');
      setSearchTerm('');
      setAdminSearch('');

      // 5. Clean local storage fully
      try {
        localStorage.removeItem('raffle_orders_v1');
        localStorage.removeItem('raffle_user_data_v1');
        localStorage.removeItem('raffle_session_id_v2');
      } catch (e) {
        console.error("Local storage reset error:", e);
      }

      alert("A rifa foi totalmente reiniciada com sucesso!");
    } catch (err) {
      console.error("Erro ao reiniciar a rifa:", err);
      alert("Erro ao reiniciar a rifa. Por favor, tente novamente.");
    } finally {
      setIsClearing(false);
    }
  };

  const handleDrawWinner = async () => {
    if (isDrawing) return;

    // Strict validation: draw only if ALL quotas are paid
    const paidCount = numbers.filter(n => n.status === 'paid').length;
    if (paidCount < raffleConfig.totalNumbers) {
      alert(`O sorteio só é permitido se TODAS as cotas estiverem preenchidas e PAGAS!\n\nCotas pagas: ${paidCount} de ${raffleConfig.totalNumbers} (${raffleConfig.totalNumbers - paidCount} restantes).`);
      return;
    }

    // Filter potential winners (preference for Paid)
    const paidNums = orders.filter(o => o.status === 'Pago').flatMap(o => o.nums);
    const reservedNums = orders.filter(o => o.status === 'Aguardando').flatMap(o => o.nums);
    
    let winnerNum = '';
    let winnerName = '';

    if (paidNums.length > 0) {
      const randomIndex = Math.floor(Math.random() * paidNums.length);
      winnerNum = paidNums[randomIndex];
    } else if (reservedNums.length > 0) {
      const randomIndex = Math.floor(Math.random() * reservedNums.length);
      winnerNum = reservedNums[randomIndex];
    } else {
      // Pick custom random ticket value within range
      const randomId = Math.floor(Math.random() * (raffleConfig.totalNumbers || 100)) + 1;
      winnerNum = String(randomId).padStart(3, '0');
    }

    const matchingOrder = orders.find(o => o.nums.includes(winnerNum));
    winnerName = matchingOrder ? matchingOrder.name : 'Sem Comprador (Número Livre)';

    setIsDrawing(true);
    setDrawCountdown(5);
    setDrawScrambled('000');

    // Interval to scramble the number visual
    const scrambleInterval = setInterval(() => {
      const tempId = Math.floor(Math.random() * (raffleConfig.totalNumbers || 100)) + 1;
      setDrawScrambled(String(tempId).padStart(3, '0'));
    }, 80);

    // Interval for countdown
    let remaining = 5;
    const countInterval = setInterval(async () => {
      remaining -= 1;
      setDrawCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(scrambleInterval);
        clearInterval(countInterval);

        // Finalize
        const finalConfig = {
          ...raffleConfig,
          winnerNumber: winnerNum,
          winnerName: winnerName,
        };

        try {
          await setDoc(doc(db, 'raffle', 'config'), finalConfig);
          setEditedConfig(finalConfig);
          setDrawScrambled(winnerNum);

          // Hold the state for 5 more seconds showing the winner details
          setDrawCountdown(-1); // special flag to denote reveal stage

          setTimeout(() => {
            setIsDrawing(false);
            setDrawCountdown(0);
          }, 5000);

        } catch (err) {
          console.error("Erro ao salvar ganhador do sorteio:", err);
          alert("Erro ao salvar ganhador no banco de dados. Por favor tente salvar manualmente.");
          setIsDrawing(false);
        }
      }
    }, 1000);
  };

  const filteredNumbers = useMemo(() => {
    return numbers.filter(n => {
      const matchesSearch = n.id.includes(searchTerm);
      const matchesFilter = filter === 'Todos' || 
        (filter === 'Disponíveis' && n.status === 'available') ||
        (filter === 'Pagos' && n.status === 'paid') ||
        (filter === 'Reservados' && n.status === 'reserved');
      return matchesSearch && matchesFilter;
    });
  }, [numbers, searchTerm, filter]);

  const toggleNumber = async (id: string, status: Status) => {
    if (!raffleConfig.isActive) return;
    
    // Safety Collision Check: check active real-time locks
    const activeLock = locks[id];
    if (activeLock && activeLock.expiresAt > now && activeLock.sessionId !== sessionId) {
      alert('Desculpe, este número acabou de ser reservado por outro usuário!');
      return;
    }

    if (status !== 'available' && !selectedNumbers.includes(id)) return;

    if (paymentStep === 'finished') {
      setPaymentStep('data');
      setSubmittedNumbers([]);
    }
    
    if (selectedNumbers.includes(id)) {
      // Optimistic locally
      setSelectedNumbers(prev => prev.filter(n => n !== id));
      try {
        await deleteDoc(doc(db, 'locks', id));
      } catch (err) {
        console.error('Failed to remove lock from Firestore:', err);
      }
    } else {
      // Optimistic locally
      setSelectedNumbers(prev => [...prev, id]);
      const remainingTime = selectedNumbers.length > 0 ? timerInSeconds : 180;
      const expiresAt = Date.now() + remainingTime * 1000;
      try {
        await setDoc(doc(db, 'locks', id), { sessionId, expiresAt });
      } catch (err) {
        console.error('Failed to create lock in Firestore:', err);
        // Rollback optimistic update
        setSelectedNumbers(prev => prev.filter(n => n !== id));
      }
    }
  };

  const getStyles = (status: Status, id: string) => {
    if (selectedNumbers.includes(id)) {
      return 'bg-violet-600 border-violet-400 shadow-lg shadow-violet-500/40 scale-105 z-10 text-white';
    }

    switch (status) {
      case 'paid':
        return 'bg-emerald-600/20 border-emerald-500/30 text-emerald-500 cursor-not-allowed';
      case 'reserved':
        return 'bg-orange-500/20 border-orange-500/30 text-orange-500 cursor-not-allowed';
      default:
        return raffleConfig.isActive 
          ? 'bg-zinc-900 border-zinc-800 hover:border-violet-500/50 hover:bg-zinc-800 text-zinc-400'
          : 'bg-zinc-900/50 border-zinc-900 text-zinc-700 cursor-not-allowed';
    }
  };

  const totalAmount = selectedNumbers.length * raffleConfig.price;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-violet-500/30">
      {/* HEADER */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-[100] shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-violet-600 via-indigo-500 to-emerald-500 p-2.5 rounded-2xl shadow-lg shadow-violet-500/20">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black bg-gradient-to-r from-violet-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent tracking-tighter leading-none">RifaMaster</h1>
              <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest mt-1">Sistemas de rifa online</p>
            </div>
          </div>

          <button 
            onClick={() => setShowAdmin(!showAdmin)}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-semibold px-4 py-2 rounded-xl transition-all active:scale-95"
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Painel Admin</span>
          </button>
        </div>
      </header>

      <main className="pb-32">
        {!isConfigLoaded && (
          <div className="max-w-7xl mx-auto px-4 mt-12 flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-12 h-12 rounded-full border-4 border-zinc-800 border-t-indigo-500 animate-spin" />
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-6 animate-pulse">
              Carregando RifaMaster em tempo real...
            </p>
          </div>
        )}

        {isConfigLoaded && !raffleConfig.isActive && !showAdmin && (
          <div className="max-w-7xl mx-auto px-4 mt-8">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-12 text-center shadow-2xl">
              <div className="bg-red-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-3xl font-black mb-2 uppercase tracking-tighter">Rifa Indisponível</h2>
              <p className="text-zinc-500 max-w-md mx-auto text-lg">
                Esta rifa ainda não foi iniciada ou está pausada pela administração. Por favor, aguarde o lançamento oficial.
              </p>
            </div>
          </div>
        )}

        {isConfigLoaded && raffleConfig.isActive && (
          <>
            {raffleConfig.winnerNumber ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, type: 'spring' }}
                className="max-w-7xl mx-auto px-4 py-16 sm:py-24"
              >
                <div className="bg-gradient-to-br from-amber-500/10 via-zinc-900 to-amber-600/5 border-2 border-amber-500/30 rounded-[2.5rem] p-10 sm:p-14 relative overflow-hidden shadow-[0_0_50px_-12px_rgba(245,158,11,0.25)] flex flex-col md:flex-row items-center justify-between gap-8 min-h-[400px]">
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none animate-pulse">
                    <PartyPopper className="w-64 h-64 text-amber-500" />
                  </div>
                  <div className="absolute -bottom-16 -left-16 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                  <div className="flex items-center gap-8 flex-col sm:flex-row text-center sm:text-left relative z-10">
                    <motion.div 
                      animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.1, 1.1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 4, repeatDelay: 2 }}
                      className="bg-amber-500/20 text-amber-400 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shrink-0 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                    >
                      <Trophy className="w-10 h-10 sm:w-12 sm:h-12" />
                    </motion.div>
                    <div>
                      <span className="bg-amber-500/15 text-amber-400 text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full border border-amber-500/20">
                        Sorteio Realizado 🏆
                      </span>
                      <h3 className="text-4xl sm:text-5xl font-black text-white mt-4 tracking-tighter leading-none">
                        Parabéns ao Ganhador! 🎉
                      </h3>
                      <p className="text-zinc-400 text-base mt-3 max-w-xl leading-relaxed">
                        Nossos sinceros parabéns para o grande felizardo(a) deste sorteio especial! Entraremos em contato diretamente com o proprietário(a) do bilhete premiado para realizar a entrega oficial do prêmio: <strong className="text-amber-400">{raffleConfig.title}</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-3xl p-8 flex flex-col items-center sm:items-start min-w-[320px] text-center sm:text-left gap-4 relative z-10 shadow-inner">
                    <div>
                      <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-1">Número Sorteado</p>
                      <span className="text-5xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300">
                        {raffleConfig.winnerNumber}
                      </span>
                    </div>
                    {raffleConfig.winnerName && (
                      <div className="border-t border-zinc-800/50 pt-3 w-full">
                        <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-1">Ganhador(a)</p>
                        <span className="text-white font-black text-xl leading-tight block truncate max-w-[280px]">
                          {raffleConfig.winnerName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <>

            {/* HERO */}
            <section className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-2 gap-8">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-zinc-800 shadow-2xl group flex items-center justify-center relative"
              >
                {raffleConfig.imageUrl ? (
                  <img
                    src={raffleConfig.imageUrl}
                    alt={raffleConfig.title}
                    className="w-full h-[240px] xs:h-[320px] sm:h-[400px] md:h-[450px] lg:h-[400px] xl:h-[450px] object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-[240px] xs:h-[320px] sm:h-[400px] md:h-[450px] lg:h-[400px] xl:h-[450px] bg-zinc-800 flex items-center justify-center">
                    <Smartphone className="w-20 h-20 text-zinc-700" />
                  </div>
                )}
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 flex flex-col justify-center gap-6 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Smartphone className="w-32 h-32" />
                </div>
                
                <div className="relative">
                  {isRaffleFullyClosed ? (
                    <span className="bg-amber-500/15 text-amber-500 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-amber-500/30 animate-pulse inline-block">
                      Rifa Fechada (Aguardar Sorteio)
                    </span>
                  ) : (
                    <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-500/20">
                      Rifa Premium
                    </span>
                  )}
                  <h2 className="text-4xl sm:text-5xl font-black mt-4 tracking-tighter leading-tight">
                    {raffleConfig.title || 'Prêmio em Breve'}
                  </h2>
                  <p className="text-zinc-400 mt-2 text-lg">{raffleConfig.description || 'Fique atento para o início desta nova oportunidade premium.'}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Cota', value: `R$ ${raffleConfig.price}`, icon: CreditCard, color: 'text-white' },
                    { label: 'Total', value: raffleConfig.totalNumbers.toString(), icon: Users, color: 'text-white' },
                    { label: 'Disponíveis', value: stats.countAvailable.toString(), icon: CheckCircle2, color: 'text-zinc-500' },
                    { label: 'Pagos', value: stats.countPaid.toString(), icon: TrendingUp, color: 'text-emerald-400' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <stat.icon className={`w-3 h-3 ${stat.color} opacity-60`} />
                        <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">{stat.label}</p>
                      </div>
                      <h3 className={`text-xl font-bold ${stat.color}`}>{stat.value}</h3>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4 flex-wrap pt-2">
                  {[
                    { label: 'Disponível', color: 'bg-zinc-800' },
                    { label: 'Reservado', color: 'bg-orange-500' },
                    { label: 'Pago', color: 'bg-emerald-500' },
                    { label: 'Selecionado', color: 'bg-violet-600' },
                  ].map(status => (
                    <div key={status.label} className="flex items-center gap-2 bg-zinc-800/30 px-3 py-1.5 rounded-lg border border-zinc-700/30">
                      <div className={`w-2.5 h-2.5 rounded-full ${status.color}`} />
                      <span className="text-xs font-semibold text-zinc-400">{status.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </section>

            {/* GRID */}
            <section className="max-w-7xl mx-auto px-4 mt-8">
              {/* QUOTAS / AUTO-SELECT */}
              <div className="mb-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={`bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 flex flex-col justify-center gap-4 shadow-xl transition-all ${isRaffleFullyClosed ? 'opacity-40 select-none' : ''}`}>
                  <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest pl-1">Seleção Rápida</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => selectRandomNumbers(5)}
                      disabled={isRaffleFullyClosed}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 hover:border-violet-500/30 border border-zinc-700/80 py-3 rounded-2xl font-black transition-all active:scale-95 text-violet-400 disabled:pointer-events-none"
                    >
                      +05
                    </button>
                    <button 
                      onClick={() => selectRandomNumbers(10)}
                      disabled={isRaffleFullyClosed}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 hover:border-violet-500/30 border border-zinc-700/80 py-3 rounded-2xl font-black transition-all active:scale-95 text-violet-400 disabled:pointer-events-none"
                    >
                      +10
                    </button>
                  </div>
                </div>

                <div className={`bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 flex flex-col justify-center gap-4 shadow-xl transition-all ${isRaffleFullyClosed ? 'opacity-40 select-none' : ''}`}>
                  <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest pl-1">Quantidade Personalizada</p>
                  <div className="flex gap-2">
                    <input 
                      type="number"
                      value={autoSelectAmount}
                      onChange={(e) => setAutoSelectAmount(e.target.value)}
                      placeholder="Qtd"
                      disabled={isRaffleFullyClosed}
                      className="w-20 bg-zinc-800 border border-zinc-700/80 rounded-2xl px-4 py-3 outline-none focus:border-violet-500/50 transition-all font-bold text-center disabled:pointer-events-none"
                    />
                    <button 
                      onClick={() => {
                        const val = parseInt(autoSelectAmount);
                        if (!isNaN(val) && val > 0) {
                          selectRandomNumbers(val);
                          setAutoSelectAmount('');
                        }
                      }}
                      disabled={isRaffleFullyClosed}
                      className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white py-3 rounded-2xl font-black transition-all active:scale-95 shadow-lg shadow-violet-500/20 disabled:pointer-events-none"
                    >
                      SELECIONAR
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800/80 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border-b-[12px] border-b-violet-600/10">
                {isRaffleFullyClosed && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-8 p-6 rounded-3xl bg-amber-500/15 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-lg shadow-amber-500/5 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <Clock className="w-24 h-24 text-amber-500" />
                    </div>
                    <div className="flex items-center gap-4 flex-col sm:flex-row relative z-10">
                      <div className="bg-amber-500/20 w-12 h-12 rounded-full flex items-center justify-center animate-pulse text-amber-400 shrink-0">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-amber-400 font-black text-lg uppercase tracking-wider">rifa fechada, aguardar sorteio</h4>
                        <p className="text-zinc-400 text-sm mt-0.5 max-w-2xl">
                          Todas as cotas foram preenchidas! Se algum usuário desistir, liberar cotas ou o cronômetro expirar, a rifa abrirá automaticamente em tempo real para novas seleções.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
                <div className="flex flex-col md:flex-row gap-6 md:items-center md:justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      Escolha seus números
                      <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md font-medium">{raffleConfig.totalNumbers} números</span>
                    </h2>
                    <p className="text-zinc-500 text-sm mt-1">
                      Clique nos números desejados para reservar. Tempo: <span className="text-violet-400 font-bold">3 minutos</span>.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative group">
                      <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                      <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar número..."
                        className="bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-4 py-2.5 w-full sm:w-48 outline-none focus:border-emerald-500/50 transition-all text-sm"
                      />
                    </div>

                    <div className="relative">
                      <Filter className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <select 
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-8 py-2.5 outline-none focus:border-emerald-500/50 transition-all text-sm appearance-none cursor-pointer w-full sm:w-auto"
                      >
                        <option>Todos</option>
                        <option>Disponíveis</option>
                        <option>Pagos</option>
                        <option>Reservados</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-3">
                  {filteredNumbers.map((number) => (
                    <button
                      key={number.id}
                      onClick={() => toggleNumber(number.id, number.status)}
                      disabled={number.status !== 'available' && !selectedNumbers.includes(number.id)}
                      className={`
                        group relative rounded-xl sm:rounded-2xl p-2 sm:p-4 transition-all duration-300 border font-bold min-h-[60px] sm:min-h-[80px] 
                        flex flex-col items-center justify-center overflow-hidden
                        ${getStyles(number.status as Status, number.id)}
                        ${number.status === 'available' && raffleConfig.isActive ? 'cursor-pointer active:scale-90' : 'cursor-default'}
                      `}
                    >
                      <span className="text-base sm:text-xl relative z-10">{number.id}</span>
                      
                      {selectedNumbers.includes(number.id) && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-[10px] mt-1 font-medium bg-violet-400/20 px-2 py-0.5 rounded-full relative z-10"
                        >
                          {formatTime(timerInSeconds)}
                        </motion.div>
                      )}

                      {number.status === 'paid' && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-10 rotate-12">
                          <CheckCircle2 className="w-12 h-12" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {filteredNumbers.length === 0 && (
                  <div className="py-20 text-center">
                    <Search className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-500 font-medium">Nenhum número encontrado para "{searchTerm}"</p>
                    <button 
                      onClick={() => {setSearchTerm(''); setFilter('Todos');}}
                      className="mt-4 text-emerald-500 font-bold hover:underline"
                    >
                      Limpar filtros
                    </button>
                  </div>
                )}
              </div>
            </section>
              </>
            )}
          </>
        )}

        <AnimatePresence mode="wait">
          {(selectedNumbers.length > 0 || paymentStep === 'finished') && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="max-w-7xl mx-auto px-4 mt-8 pb-32"
              id="payment-section"
              onViewportEnter={() => setIsCheckoutVisible(true)}
              onViewportLeave={() => setIsCheckoutVisible(false)}
            >
              <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl overflow-hidden min-h-[400px] flex flex-col">
                <AnimatePresence mode="wait">
                  {paymentStep === 'data' && (
                    <motion.div
                      key="step-data"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex-1"
                    >
                      <div className="mb-8">
                        <h2 className="text-3xl font-black mb-2">Seus Dados</h2>
                        <p className="text-zinc-500 font-medium">Preencha seus dados para vincular aos números.</p>
                      </div>

                      <div className="space-y-6 max-w-2xl">
                        <div>
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-3 pl-1">
                            Nome Completo
                          </label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input
                              value={userData.name}
                              onChange={(e) => setUserData({...userData, name: e.target.value})}
                              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-emerald-500/50 focus:bg-zinc-800 transition-all text-lg"
                              placeholder="Ex: João da Silva"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-3 pl-1">
                            WhatsApp para contato
                          </label>
                          <div className="relative">
                            <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input
                              type="text"
                              inputMode="tel"
                              value={userData.phone}
                              onChange={(e) => {
                                const raw = e.target.value;
                                // Permitir apenas numeros, espacos, mais, hifens e parenteses
                                const cleaned = raw.replace(/[^0-9\s()+-]/g, "");
                                setUserData({...userData, phone: cleaned});
                              }}
                              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-emerald-500/50 focus:bg-zinc-800 transition-all text-lg"
                              placeholder="(99) 99999-9999"
                            />
                          </div>
                        </div>
                      </div>

                      {mpError && (
                          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center text-sm font-bold mt-4">
                            {mpError}
                          </div>
                        )}

                        <button 
                          disabled={!userData.name || !userData.phone || isGeneratingPayment}
                          onClick={handleCreateMercadoPagoPayment}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-5 rounded-2xl text-xl transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
                        >
                          {isGeneratingPayment ? (
                            <>
                              <RefreshCw className="w-5 h-5 animate-spin" />
                              RESERVANDO COTAS...
                            </>
                          ) : (
                            <>
                              <QrCode className="w-5 h-5" />
                              RESERVAR E VER CHAVE PIX
                            </>
                          )}
                        </button>
                      </motion.div>
                    )}

                    {paymentStep === 'pix' && (
                      <motion.div
                        key="step-pix"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -25 }}
                      className="grid lg:grid-cols-2 gap-10"
                    >
                      <div>
                        <button 
                          onClick={() => setPaymentStep('data')}
                          className="text-zinc-500 hover:text-white flex items-center gap-2 mb-6 font-bold text-sm transition-colors"
                        >
                          <X className="w-4 h-4" /> Voltar para dados
                        </button>
                        
                        <div className="flex items-center justify-between mb-8 overflow-hidden">
                          <div className="flex flex-col">
                            <h2 className="text-3xl font-black">Pagamento Pix</h2>
                            <span className="text-emerald-500 text-xs font-bold uppercase tracking-widest mt-1">Sorteio Organizado Manualmente</span>
                          </div>
                          <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-500 text-[10px] px-3 py-1.5 rounded-full font-black border border-yellow-500/20 animate-pulse">
                            <Clock className="w-3 h-3" />
                            RESERVA ATIVA: {formatTime(timerInSeconds)}
                          </div>
                        </div>

                        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-3xl p-8 mb-6 flex flex-col items-center justify-center relative group">
                          <div className="p-4 bg-white rounded-2xl shadow-[0_0_50px_rgba(255,255,255,0.1)] mb-4 flex items-center justify-center overflow-hidden w-48 h-48 md:w-56 md:h-56">
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mpPaymentInfo?.qrCode || "SIMULADO")}`} 
                              className="w-full h-full object-contain"
                              alt="Pix QR Code"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest text-center mt-2 leading-relaxed">
                            Abra o aplicativo de pagamentos do seu Banco, escolha "Pix" e aponte a câmera para ler o QR Code
                          </p>
                        </div>

                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                          <p className="text-emerald-500 font-black">Valor total: R$ {totalAmount},00</p>
                        </div>
                      </div>

                      <div className="flex flex-col justify-center space-y-6">
                        <div className="space-y-4">
                          {/* Order Details Card */}
                          <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-5 space-y-3">
                            <div className="flex justify-between border-b border-zinc-800/80 pb-2">
                              <span className="text-xs text-zinc-500 uppercase font-black tracking-wider">Código Reserva</span>
                              <span className="text-sm font-mono font-black text-amber-500">{mpPaymentInfo?.orderId}</span>
                            </div>
                            <div className="flex justify-between border-b border-zinc-800/80 pb-2">
                              <span className="text-xs text-zinc-500 uppercase font-black tracking-wider">Titular</span>
                              <span className="text-sm font-bold text-zinc-350">{raffleConfig.pixReceiver || 'Admin'}</span>
                            </div>
                            <div className="flex justify-between border-b border-zinc-800/80 pb-2">
                              <span className="text-xs text-zinc-500 uppercase font-black tracking-wider">Banco</span>
                              <span className="text-sm font-bold text-zinc-350">{raffleConfig.pixBank || 'Banco do Recebedor'}</span>
                            </div>
                            <div className="flex justify-between pb-1">
                              <span className="text-xs text-zinc-500 uppercase font-black tracking-wider">Cotas</span>
                              <span className="text-sm font-bold text-emerald-400 font-mono">{submittedNumbers.join(', ')}</span>
                            </div>
                          </div>

                          <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-2xl p-5 flex items-center gap-3.5">
                            <div className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Sincronização em Tempo Real</p>
                              <p className="text-sm font-bold text-zinc-200">Aguardando aprovação do admin. Esta tela atualizará automaticamente!</p>
                            </div>
                          </div>

                          <div className="group">
                            <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-2 pl-1">Código Pix / Chave Pix</p>
                            <div className="bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 group-hover:border-emerald-500/50 transition-colors">
                              <span className="truncate font-mono font-bold text-emerald-400 text-xs flex-1">
                                {mpPaymentInfo?.qrCode || 'Chave Pix não configurada...'}
                              </span>
                              <button 
                                onClick={() => {
                                  if (mpPaymentInfo?.qrCode) {
                                    navigator.clipboard.writeText(mpPaymentInfo.qrCode);
                                    setIsCopied(true);
                                    setTimeout(() => setIsCopied(false), 2000);
                                  }
                                }}
                                className={`
                                  px-4 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 shadow-lg shrink-0 
                                  ${isCopied ? 'bg-emerald-500 text-black shadow-emerald-500/20' : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/20'}
                                `}
                              >
                                {isCopied ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Copiado!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    Copiar Chave
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* WhatsApp Receipt Button */}
                        <div className="pt-2">
                          <a
                            href={`https://api.whatsapp.com/send?phone=${(raffleConfig.pixPhone || raffleConfig.pixKey || "").replace(/\D/g, '')}&text=${encodeURIComponent(
                              `Olá! Fiz o pagamento de R$ ${totalAmount},00 referente às cotas reservadas!\n\n` +
                              `📋 *Pedido:* ${mpPaymentInfo?.orderId}\n` +
                              `👤 *Nome:* ${userData.name}\n` +
                              `📞 *Telefone:* ${userData.phone}\n` +
                              `🎟️ *Cotas:* ${submittedNumbers.join(', ')}\n` +
                              `💰 *Valor:* R$ ${totalAmount},00\n\n` +
                              `Segue o comprovante do Pix em anexo.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 px-4 rounded-2xl text-sm uppercase tracking-wider transition-all shadow-lg hover:shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2"
                          >
                            <MessageCircle className="w-5 h-5 flex-shrink-0" />
                            Enviar Comprovante de Pagamento
                          </a>
                        </div>

                        <div className="border-t border-zinc-800/80 pt-4">
                          <p className="text-zinc-500 text-[10px] text-center uppercase tracking-widest leading-relaxed">
                            Envie o comprovante pelo WhatsApp acima para agilizar a liberação das suas cotas!
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {paymentStep === 'finished' && (
                    <motion.div
                      key="step-finished"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex-1 flex flex-col items-center justify-center py-10"
                    >
                      <div className="bg-emerald-500/20 p-6 rounded-full mb-8 relative">
                        <CheckCircle2 className="w-20 h-20 text-emerald-500" />
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: "spring" }}
                          className="absolute -top-2 -right-2 bg-white text-emerald-600 p-2 rounded-full shadow-lg"
                        >
                          <Smartphone className="w-6 h-6" />
                        </motion.div>
                      </div>

                      <h2 className="text-4xl font-black text-center mb-4 leading-tight">Muito Obrigado e Boa Sorte! 🍀</h2>
                      <p className="text-zinc-400 text-center max-w-md text-lg mb-10">
                        Sua solicitação foi enviada com sucesso. Nossa equipe administrativa irá validar seu pagamento em breve.
                      </p>

                      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-3xl p-8 w-full max-w-md text-center">
                        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-4">Seus Números Reservados</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {submittedNumbers.map(n => (
                            <span key={n} className="bg-zinc-900 border border-zinc-700 px-4 py-2 rounded-xl font-mono font-bold text-emerald-400 text-lg">
                              {n}
                            </span>
                          ))}
                        </div>
                        <p className="text-zinc-500 text-[10px] mt-6 uppercase font-bold tracking-widest">
                          Tire um print desta tela para o seu controle.
                        </p>
                      </div>

                      <button 
                        onClick={() => {
                          setSubmittedNumbers([]);
                          setPaymentStep('data');
                          const el = document.getElementById('top-section') || document.documentElement;
                          el?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="mt-10 bg-emerald-500 hover:bg-emerald-400 text-black font-black px-8 py-4 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2 text-md"
                      >
                        SELECIONAR MAIS NÚMEROS
                      </button>

                      <button 
                        onClick={() => {
                          clearMyLocks();
                          setSelectedNumbers([]);
                          setSubmittedNumbers([]);
                          setPaymentStep('data');
                        }}
                        className="mt-4 text-zinc-500 hover:text-zinc-400 font-bold text-sm transition-all"
                      >
                        Limpar seleção e voltar ao início
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ADMIN MODAL */}
        <AnimatePresence>
          {showAdmin && (
            <motion.section 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <div 
                className="absolute inset-0" 
                onClick={() => setShowAdmin(false)}
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-6 sm:p-10 shadow-[0_0_100px_rgba(0,0,0,0.5)] w-full max-w-6xl max-h-[90vh] overflow-y-auto relative z-10"
              >
                {!isAdminAuthenticated ? (
                  <div className="max-w-md mx-auto py-20 text-center">
                    <div className="bg-zinc-800 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-zinc-700">
                      <ShieldCheck className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h2 className="text-3xl font-black mb-2">Acesso Restrito</h2>
                    <p className="text-zinc-500 mb-8">Digite a senha administrativa para continuar.</p>
                    <form onSubmit={handleAdminLogin} className="space-y-4">
                      <input 
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-4 text-center text-3xl tracking-[1em] outline-none focus:border-emerald-500/50 transition-all font-mono"
                        autoFocus
                      />
                      <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-2xl text-lg transition-all active:scale-95">
                        ENTRAR NO PAINEL
                      </button>
                    </form>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
                      <div className="flex items-center gap-4">
                        <div className="bg-zinc-800 p-3 rounded-2xl border border-zinc-700">
                          <ShieldCheck className="w-8 h-8 text-emerald-400" />
                        </div>
                        <div>
                          <h2 className="text-3xl font-black tracking-tight">Painel Admin</h2>
                          <p className="text-zinc-400 font-medium">Gestão completa e financeira</p>
                        </div>
                      </div>

                      <div className="flex gap-3 items-center">
                        <button 
                          disabled={isClearing}
                          onClick={handleClearRaffle}
                          className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-black border border-red-500/20 hover:border-red-500 rounded-2xl transition-all text-sm font-black uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {isClearing ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Reiniciar Rifa
                        </button>
                        <button 
                          onClick={() => setIsAdminAuthenticated(false)}
                          className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl border border-zinc-700 transition-colors text-sm font-bold"
                        >
                          Sair
                        </button>
                        <button 
                          onClick={() => setShowAdmin(false)}
                          className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl border border-zinc-700 transition-colors"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
                      {/* STATS */}
                      <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                          <p className="text-emerald-500/60 text-[10px] uppercase font-black tracking-widest mb-2">Valor Arrecadado (Pagos)</p>
                          <h3 className="text-4xl font-black text-emerald-400">R$ {stats.arrecadado.toLocaleString('pt-BR')}</h3>
                          <p className="text-emerald-500/40 text-xs mt-2">{stats.countPaid} cotas confirmadas</p>
                        </div>
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-3xl p-6 shadow-[0_0_20px_rgba(249,115,22,0.05)]">
                          <p className="text-orange-500/60 text-[10px] uppercase font-black tracking-widest mb-2">Valor a Entrar (Aguardando)</p>
                          <h3 className="text-4xl font-black text-orange-500">R$ {stats.aEntrar.toLocaleString('pt-BR')}</h3>
                          <p className="text-orange-500/40 text-xs mt-2">{stats.countReserved} cotas pendentes</p>
                        </div>
                        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-3xl p-6">
                          <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-2">Taxa de Ocupação</p>
                          <h3 className="text-4xl font-black text-white">{Math.round(((stats.countPaid + stats.countReserved) / raffleConfig.totalNumbers) * 100)}%</h3>
                          <div className="w-full bg-zinc-700 h-2 rounded-full mt-4 overflow-hidden">
                            <div 
                              className="bg-emerald-500 h-full transition-all duration-1000" 
                              style={{ width: `${(stats.countPaid / (raffleConfig.totalNumbers || 1)) * 100}%` }}
                            />
                            <div 
                              className="bg-orange-500 h-full transition-all duration-1000" 
                              style={{ width: `${(stats.countReserved / (raffleConfig.totalNumbers || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-3xl p-6">
                          <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-2">Status da RIFA</p>
                          <div className="flex items-center gap-4 mt-2">
                             <div className={`w-4 h-4 rounded-full ${raffleConfig.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                             <h3 className="text-2xl font-black uppercase tracking-tighter">
                               {raffleConfig.isActive ? 'Ativa no Site' : 'Pausada'}
                             </h3>
                          </div>
                          <button 
                            onClick={async () => {
                              try {
                                await setDoc(doc(db, 'raffle', 'config'), { ...raffleConfig, isActive: !raffleConfig.isActive });
                              } catch (err) {
                                console.error('Failed to toggle status:', err);
                              }
                            }}
                            className={`mt-4 w-full py-2 rounded-xl text-xs font-black transition-all ${raffleConfig.isActive ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black'}`}
                          >
                            {raffleConfig.isActive ? 'DESATIVAR AGORA' : 'ATIVAR AGORA'}
                          </button>
                        </div>
                      </div>

                      {/* CONFIGURATION FORM */}
                      <div className="bg-zinc-800/30 border border-zinc-800 rounded-3xl p-6 flex flex-col gap-5">
                        <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">Configuração da Rifa</h4>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Título do Prêmio</label>
                            <input 
                              value={editedConfig.title}
                              onChange={(e) => setEditedConfig(prev => ({ ...prev, title: e.target.value }))}
                              placeholder="Ex: iPhone 15 Pro Max"
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-violet-500/50"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Preço por Cota (R$)</label>
                            <input 
                              type="number"
                              value={editedConfig.price || ''}
                              onChange={(e) => setEditedConfig(prev => ({ ...prev, price: Number(e.target.value) }))}
                              placeholder="Ex: 10"
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-violet-500/50"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Total de Números</label>
                            <input 
                              type="number"
                              value={editedConfig.totalNumbers || ''}
                              onChange={(e) => setEditedConfig(prev => ({ ...prev, totalNumbers: Number(e.target.value) }))}
                              placeholder="Ex: 150"
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-violet-500/50"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Descrição</label>
                            <textarea 
                              value={editedConfig.description}
                              onChange={(e) => setEditedConfig(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Ex: Lacrado, 256GB..."
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-violet-500/50 min-h-[80px]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Imagem da Rifa</label>
                            <div className="mt-2 flex items-center gap-4">
                              {editedConfig.imageUrl ? (
                                <img src={editedConfig.imageUrl} className="w-16 h-16 rounded-xl object-cover border border-zinc-700" alt="Preview" />
                              ) : (
                                <div className="w-16 h-16 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-600">
                                  <Smartphone className="w-6 h-6" />
                                </div>
                              )}
                              <div className="flex-1 border-2 border-dashed border-zinc-700 rounded-xl p-4 text-center group hover:border-violet-500/50 transition-colors cursor-pointer relative">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider group-hover:text-violet-500">Enviar Imagem</span>
                                <input 
                                  type="file" 
                                  accept="image/*"
                                  className="absolute inset-0 opacity-0 cursor-pointer" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        const base64String = reader.result as string;
                                        setEditedConfig(prev => ({ ...prev, imageUrl: base64String }));
                                      };
                                      reader.onerror = () => {
                                        alert('Erro ao carregar o arquivo da imagem.');
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </div>
                            </div>
                            <input 
                              value={editedConfig.imageUrl}
                              onChange={(e) => setEditedConfig(prev => ({ ...prev, imageUrl: e.target.value }))}
                              placeholder="Ou cole a URL aqui..."
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-xs outline-none focus:border-violet-500/50 mt-2"
                            />
                          </div>

                          <div className="border-t border-zinc-800/80 pt-4 flex flex-col gap-4">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Dados do Pix</h5>
                            
                            <div>
                              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Chave Pix</label>
                              <input 
                                value={editedConfig.pixKey || ''}
                                onChange={(e) => setEditedConfig(prev => ({ ...prev, pixKey: e.target.value }))}
                                placeholder="Ex: CNPJ, Telefone, E-mail..."
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500/50"
                              />
                            </div>
                            
                            <div>
                              <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Nome do Recebedor (Titular)</label>
                              <input 
                                value={editedConfig.pixReceiver || ''}
                                onChange={(e) => setEditedConfig(prev => ({ ...prev, pixReceiver: e.target.value }))}
                                placeholder="Ex: João Silva ou Empresa Ltda"
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500/50"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Instituição Bancária (Banco)</label>
                              <input 
                                value={editedConfig.pixBank || ''}
                                onChange={(e) => setEditedConfig(prev => ({ ...prev, pixBank: e.target.value }))}
                                placeholder="Ex: Nubank, Itaú, Bradesco..."
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500/50"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">WhatsApp do Admin (para Comprovantes)</label>
                              <input 
                                value={editedConfig.pixPhone || ''}
                                onChange={(e) => setEditedConfig(prev => ({ ...prev, pixPhone: e.target.value }))}
                                placeholder="Ex: 5511999999999 (Apenas números com DDD)"
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500/50"
                              />
                            </div>
                          </div>

                          <div className="border-t border-zinc-800/80 pt-4 flex flex-col gap-4">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center justify-between">
                              <span>🏆 Resultado do Sorteio (Ganhador)</span>
                              {isDrawing && (
                                <span className="animate-pulse text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md text-[9px] font-black">
                                  SORTEANDO EM {drawCountdown}s
                                </span>
                              )}
                            </h5>

                            {/* Automated Draw Widget */}
                            <div className="bg-zinc-950/60 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 relative overflow-hidden">
                              {(() => {
                                const paidCount = numbers.filter(n => n.status === 'paid').length;
                                const total = raffleConfig.totalNumbers || 100;
                                const allPaid = paidCount === total;

                                if (isDrawing) {
                                  return (
                                    <div className="text-center py-2">
                                      <div className="text-4xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 animate-pulse tracking-widest">
                                        {drawScrambled}
                                      </div>
                                      <p className="text-zinc-500 text-[9px] uppercase font-black tracking-widest mt-1">
                                        Sorteando entre as cotas ativas...
                                      </p>
                                    </div>
                                  );
                                }

                                return (
                                  <>
                                    {!allPaid && (
                                      <div className="w-full text-zinc-400 text-xs text-center font-bold px-3 py-2 bg-red-500/10 border border-red-500/25 rounded-xl flex flex-col items-center justify-center gap-1">
                                        <div className="flex items-center gap-1.5 text-red-500">
                                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                          <span className="font-extrabold text-[10px] uppercase tracking-wider">Sorteio Bloqueado</span>
                                        </div>
                                        <span className="text-[11px] text-zinc-350">
                                          Faltam {total - paidCount} cotas a serem preenchidas e pagas ({paidCount}/{total} pagas)
                                        </span>
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      disabled={!allPaid}
                                      onClick={handleDrawWinner}
                                      className={`w-full flex items-center justify-center gap-2 font-black text-xs py-3 px-4 rounded-xl transition-all shadow-lg active:scale-95 ${
                                        allPaid 
                                          ? "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black cursor-pointer" 
                                          : "bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed opacity-50"
                                      }`}
                                    >
                                      <Trophy className="w-4 h-4" />
                                      SORTEAR AUTOMÁTICO (CRONÔMETRO DE 5S)
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                            
                            <div>
                              <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Número Ganhador</label>
                              <input 
                                value={editedConfig.winnerNumber || ''}
                                onChange={(e) => {
                                  const typed = e.target.value;
                                  const cleanNum = typed.trim();
                                  let autoName = editedConfig.winnerName || '';
                                  
                                  if (cleanNum) {
                                    // Procura o pedido pago primeiro, depois qualquer pedido ativo que possua esse número
                                    const matchingOrder = orders.find(o => o.status === 'Pago' && o.nums.includes(cleanNum)) 
                                      || orders.find(o => o.status !== 'Cancelado' && o.nums.includes(cleanNum));
                                    if (matchingOrder) {
                                      autoName = matchingOrder.name;
                                    }
                                  }
                                  
                                  setEditedConfig(prev => ({ 
                                    ...prev, 
                                    winnerNumber: typed,
                                    winnerName: autoName
                                  }));
                                }}
                                placeholder="Ex: 082 (Deixe em branco para ocultar)"
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-amber-500/50"
                              />
                            </div>
                            
                            <div>
                              <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Nome do Ganhador</label>
                              <input 
                                value={editedConfig.winnerName || ''}
                                onChange={(e) => setEditedConfig(prev => ({ ...prev, winnerName: e.target.value }))}
                                placeholder="Ex: Lucas de Souza Santos"
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-amber-500/50"
                              />
                            </div>
                          </div>

                          <button
                            onClick={async () => {
                              const paidCount = numbers.filter(n => n.status === 'paid').length;
                              const total = raffleConfig.totalNumbers || 100;
                              if (editedConfig.winnerNumber && paidCount < total) {
                                alert(`O sorteio só é permitido se TODAS as cotas estiverem preenchidas e PAGAS!\n\nCotas pagas: ${paidCount} de ${total} (${total - paidCount} restantes).`);
                                return;
                              }
                              try {
                                await setDoc(doc(db, 'raffle', 'config'), editedConfig);
                                alert('Configuração salva com sucesso!');
                              } catch (err) {
                                console.error('Erro ao salvar no Firestore:', err);
                                alert('Erro ao salvar a configuração.');
                              }
                            }}
                            className="w-full mt-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black py-3 rounded-xl transition-all shadow-lg active:scale-95"
                          >
                            SALVAR CONFIGURAÇÃO
                          </button>
                        </div>
                      </div>

                    </div>

                    <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <h3 className="text-xl font-bold flex items-center gap-2">
                          Pedidos Recentes
                          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                            {adminSearch ? `${filteredOrders.length} encontrados` : `${orders.length} total`}
                          </span>
                       </h3>

                       {/* Search Input for Admin */}
                       <div className="relative w-full md:w-80 group">
                         <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                         <input 
                           type="text"
                           value={adminSearch}
                           onChange={(e) => setAdminSearch(e.target.value)}
                           placeholder="Buscar por nome ou cota (ex: 006)..."
                           className="w-full bg-zinc-850 border border-zinc-700 hover:border-zinc-650 rounded-2xl pl-11 pr-10 py-3 text-sm outline-none focus:border-emerald-500/50 focus:bg-zinc-805 transition-all text-white placeholder-zinc-500 font-medium"
                         />
                         {adminSearch && (
                           <button 
                             onClick={() => setAdminSearch('')}
                             className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs font-bold"
                           >
                             ×
                           </button>
                         )}
                       </div>
                    </div>

                    <div className="overflow-x-auto rounded-3xl border border-zinc-800 bg-zinc-800/30">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-800/50 text-zinc-500 text-[10px] uppercase font-black tracking-widest">
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Cliente</th>
                            <th className="px-6 py-4">WhatsApp</th>
                            <th className="px-6 py-4">Números</th>
                            <th className="px-6 py-4">Valor</th>
                            <th className="px-6 py-4 text-center">Ações</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-zinc-800/50">
                          {filteredOrders.map((item) => (
                            <tr key={item.id} className="hover:bg-zinc-800/20 transition-colors">
                              <td className="px-6 py-5">
                                <span className={`
                                  text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider border
                                  ${item.status === 'Pago' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                    item.status === 'Cancelado' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                    'bg-orange-500/10 text-orange-500 border-orange-500/20'}
                                `}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="px-6 py-5 font-bold">{item.name}</td>
                              <td className="px-6 py-5 text-zinc-400 tabular-nums">{item.phone}</td>
                              <td className="px-6 py-5">
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {item.nums.map(n => (
                                    <span key={n} className="bg-zinc-800 px-2 py-0.5 rounded text-[10px] font-mono border border-zinc-700 flex items-center gap-1">
                                      {n}
                                      {item.status === 'Aguardando' && (
                                        <button 
                                          onClick={() => handleReleaseSingleCota(item.id, n)}
                                          title={`Liberar cota ${n}`}
                                          className="text-red-500 hover:text-red-400 font-bold ml-1 text-xs px-0.5"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-6 py-5 font-black text-emerald-400">R$ {item.val}</td>
                              <td className="px-6 py-5">
                                {item.status === 'Aguardando' && (
                                  <div className="flex gap-2 justify-center">
                                    <button 
                                      onClick={() => handleAction(item.id, 'confirm')}
                                      title="Confirmar Todas"
                                      className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-black hover:shadow-lg hover:shadow-emerald-500/20 px-3 py-2 rounded-xl border border-emerald-500/20 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Confirmar todas
                                    </button>
                                    <button 
                                      onClick={() => handleAction(item.id, 'cancel')}
                                      title="Recusar Todas"
                                      className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-black hover:shadow-lg hover:shadow-red-500/20 px-3 py-2 rounded-xl border border-red-500/20 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      Recusar todas
                                    </button>
                                  </div>
                                )}
                                {item.status !== 'Aguardando' && (
                                  <span className="text-[10px] text-zinc-600 block text-center italic">Sem ações</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* FIXED SUMMARY BAR */}
      <AnimatePresence>
        {selectedNumbers.length > 0 && raffleConfig.isActive && paymentStep !== 'finished' && !isCheckoutVisible && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-xl z-[150] shadow-[0_-10px_50px_rgba(0,0,0,0.8)]"
          >
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="bg-violet-600 p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg shadow-violet-600/20 flex flex-col items-center min-w-[50px] sm:min-w-[60px]">
                  <span className="text-lg sm:text-2xl font-black tabular-nums leading-none">{selectedNumbers.length}</span>
                  <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-tighter opacity-60">COTAS</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <p className="text-zinc-500 text-[8px] sm:text-[10px] uppercase font-black tracking-widest hidden xs:block">Expira em:</p>
                    <span className="text-violet-400 text-[10px] font-black tabular-nums">{formatTime(timerInSeconds)}</span>
                  </div>
                  {paymentStep === 'data' ? (
                    <h3 className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-tight mt-0.5">
                      Finalize para ver o total
                    </h3>
                  ) : (
                    <h3 className="text-lg sm:text-2xl font-black text-white tabular-nums leading-none mt-0.5">
                      R$ {totalAmount},00
                    </h3>
                  )}
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <button 
                  onClick={() => {
                    clearMyLocks();
                    setSelectedNumbers([]);
                    setPaymentStep('data');
                    setUserData({ name: '', phone: '' });
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 p-3 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl font-bold transition-all active:scale-95 border border-zinc-700"
                  title="Limpar seleção"
                >
                  <span className="hidden sm:inline">LIMPAR</span>
                  <div className="sm:hidden w-4 h-4 flex items-center justify-center text-[10px]">X</div>
                </button>

                {paymentStep === 'data' ? (
                  <button 
                    onClick={() => {
                      const el = document.getElementById('payment-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-3 sm:px-8 sm:py-3 rounded-xl sm:rounded-2xl font-black transition-all shadow-xl shadow-violet-500/20 active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm"
                  >
                    CONTINUAR
                    <Smartphone className="w-4 h-4" />
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      const el = document.getElementById('payment-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-3 sm:px-8 sm:py-3 rounded-xl sm:rounded-2xl font-black transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm"
                  >
                    FINALIZAR
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sorteador Só Pesca Fullscreen Drawing Countdown Takeover */}
      <AnimatePresence>
        {isDrawing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/98 backdrop-blur-2xl z-[999] flex flex-col items-center justify-center p-6 text-center select-none"
          >
            {/* Ambient glowing blobs */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
            <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-violet-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />

            {/* Main Stage */}
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-xl w-full bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-amber-500/30 rounded-[3rem] p-8 sm:p-12 relative overflow-hidden shadow-[0_0_80px_rgba(245,158,11,0.25)] flex flex-col items-center gap-8"
            >
              {drawCountdown === -1 ? (
                <>
                  {/* Winner Celebrating State */}
                  <div className="flex flex-col items-center gap-2">
                    <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-black uppercase tracking-widest px-5 py-2 rounded-full shadow-lg shadow-amber-500/35 animate-bounce">
                      🏆 GANHADOR CONFIRMADO 🎣
                    </span>
                    <h2 className="text-white font-black text-2xl sm:text-3xl tracking-tighter mt-3 leading-none">
                      Parabéns ao Sorteado! 🎉
                    </h2>
                  </div>

                  {/* Big Ganhador Trophy Emblem */}
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="relative w-36 h-36 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center border-2 border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.2)]"
                  >
                    <Trophy className="w-16 h-16 animate-pulse" />
                  </motion.div>

                  {/* Winner Number and Name Big Card */}
                  <div className="w-full space-y-4">
                    <div className="bg-zinc-950/80 border-2 border-amber-500/50 rounded-2xl py-4 px-6 flex flex-col items-center gap-1 shadow-2xl">
                      <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                        Número Premiado
                      </span>
                      <span className="text-6xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 tracking-widest">
                        {drawScrambled}
                      </span>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-6 flex flex-col items-center gap-1">
                      <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                        Nome do Ganhador(a)
                      </span>
                      <span className="text-white font-black text-2xl tracking-tight block truncate max-w-full">
                        {editedConfig.winnerName}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Return indicator */}
                  <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold animate-pulse mt-1">
                    <span>Retornando ao painel em instantes...</span>
                  </div>
                </>
              ) : (
                <>
                  {/* Decorative Header */}
                  <div className="flex flex-col items-center gap-2">
                    <span className="bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-amber-500/20">
                      Sorteador Oficial Só Pesca 🎣
                    </span>
                    <h2 className="text-zinc-400 font-bold uppercase tracking-widest text-xs mt-2">
                      Gerando Resultado Premiado
                    </h2>
                  </div>

                  {/* Big Countdown Timer Circle / Card */}
                  <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
                    {/* Visual animated ring */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ ease: "linear", duration: 2, repeat: Infinity }}
                      className="absolute inset-0 border-4 border-dashed border-amber-500/20 rounded-full"
                    />
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ ease: "linear", duration: 4, repeat: Infinity }}
                      className="absolute inset-4 border border-zinc-700/50 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="absolute inset-8 bg-amber-500/5 rounded-full border border-amber-500/10"
                    />
                    
                    {/* Big Giant Countdown Digit */}
                    <span className="absolute text-8xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400 select-none cursor-default drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                      {drawCountdown}
                    </span>
                  </div>

                  {/* Live spinning ticker style container */}
                  <div className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-5 px-6 flex flex-col items-center gap-2 relative shadow-inner">
                    <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                      Número Embaralhado
                    </span>
                    <span className="text-5xl font-mono font-black text-amber-400 tracking-wider">
                      {drawScrambled}
                    </span>
                  </div>

                  {/* Informative Subtext */}
                  <p className="text-zinc-400 text-sm max-w-sm mt-2 font-medium leading-relaxed">
                    Aguarde... Buscando ganhador entre todos os compradores de bilhetes ativas da nossa rifa premium!
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

