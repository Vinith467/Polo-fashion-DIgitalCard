// src/App.jsx - Updated with Navigation and Notifications
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './services/firebase';
import { getOrdersNeedingNotifications } from './services/notificationService';
import NavigationBar from './components/NavigationBar';
import HomePage from './components/HomePage';
import CustomerDatabase from './components/CustomerDatabase';
import StaffManagement from './components/StaffManagement';
import LoadingOverlay from './components/LoadingOverlay';
import { Button, Badge, Toast, ToastContainer } from 'react-bootstrap';
import { Bell } from './components/Icons';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
    const [currentPage, setCurrentPage] = useState('home');
    const [customers, setCustomers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNotificationAlert, setShowNotificationAlert] = useState(false);
    const [pendingNotifications, setPendingNotifications] = useState({ tomorrow: [], today: [] });

    useEffect(() => {
        const loadData = async () => {
            try {
                // Load customers
                const customersSnapshot = await getDocs(collection(db, 'customers'));
                const customersData = customersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setCustomers(customersData);

                // Load orders
                const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
                const ordersSnapshot = await getDocs(ordersQuery);
                const ordersData = ordersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setOrders(ordersData);

                // Check for pending notifications
                const pending = getOrdersNeedingNotifications(ordersData);
                if (pending.tomorrow.length > 0 || pending.today.length > 0) {
                    setPendingNotifications(pending);
                    setShowNotificationAlert(true);
                }

                setLoading(false);
            } catch (error) {
                console.error('Error loading data:', error);
                setLoading(false);
                alert('Failed to load data from cloud. Please refresh the page.');
            }
        };

        loadData();
    }, []);

    const sendNotifications = () => {
        // Open WhatsApp for each pending notification with delay
        pendingNotifications.tomorrow.forEach((order, index) => {
            setTimeout(() => {
                sendReadyTomorrowNotification(order);
            }, index * 2000); // 2 second delay between each
        });

        pendingNotifications.today.forEach((order, index) => {
            setTimeout(() => {
                sendReadyTodayNotification(order);
            }, (pendingNotifications.tomorrow.length + index) * 2000);
        });

        setShowNotificationAlert(false);
    };

    const sendReadyTomorrowNotification = (order) => {
        let phone = order.customerPhone.replace(/\D/g, '');
        if (phone.length === 10) {
            phone = '91' + phone;
        }

        const message = `Hi ${order.customerName}! 

🔔 Reminder from Polo Fashions

Your order (Card #${order.cardNumber}) will be ready TOMORROW!

📅 Ready Date: ${order.readyDate}
💰 Balance Due: ₹${order.balance}

We look forward to seeing you tomorrow!

🏪 Polo Fashions
📞 9742445626`;

        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        const notificationKey = `notif_tomorrow_${order.id}_${order.readyDate}`;
        localStorage.setItem(notificationKey, 'sent');
        window.open(whatsappUrl, '_blank');
    };

    const sendReadyTodayNotification = (order) => {
        let phone = order.customerPhone.replace(/\D/g, '');
        if (phone.length === 10) {
            phone = '91' + phone;
        }

        const message = `Hi ${order.customerName}! 

✅ Good News from Polo Fashions!

Your order (Card #${order.cardNumber}) is READY for pickup TODAY! 🎉

📅 Ready Date: ${order.readyDate}
💰 Balance Due: ₹${order.balance}

Please visit us at your convenience to collect your order.

📍 #GF-30, Anjuman-Eslamiya Complex
    T.V.S. Road, Kollegal-571 440

🏪 Polo Fashions
📞 9742445626`;

        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        const notificationKey = `notif_today_${order.id}_${order.readyDate}`;
        localStorage.setItem(notificationKey, 'sent');
        window.open(whatsappUrl, '_blank');
    };

    if (loading) {
        return <LoadingOverlay message="Loading from cloud..." />;
    }

    return (
        <div>
            {/* Notification Alert */}
            {showNotificationAlert && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    zIndex: 9999,
                    maxWidth: '400px'
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        padding: '20px',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                    }}>
                        <div className="d-flex align-items-start gap-3">
                            <Bell size={32} />
                            <div className="flex-grow-1">
                                <h5 className="mb-2 fw-bold">Pending Notifications</h5>
                                {pendingNotifications.tomorrow.length > 0 && (
                                    <p className="mb-1">
                                        <Badge bg="warning" text="dark">{pendingNotifications.tomorrow.length}</Badge>
                                        {' '}orders ready tomorrow
                                    </p>
                                )}
                                {pendingNotifications.today.length > 0 && (
                                    <p className="mb-3">
                                        <Badge bg="success">{pendingNotifications.today.length}</Badge>
                                        {' '}orders ready today
                                    </p>
                                )}
                                <div className="d-flex gap-2">
                                    <Button 
                                        variant="light" 
                                        size="sm"
                                        onClick={sendNotifications}
                                        className="fw-bold"
                                    >
                                        Send All via WhatsApp
                                    </Button>
                                    <Button 
                                        variant="outline-light" 
                                        size="sm"
                                        onClick={() => setShowNotificationAlert(false)}
                                    >
                                        Dismiss
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Bar - Show on all pages */}
            <NavigationBar 
                currentPage={currentPage} 
                onNavigate={setCurrentPage}
            />

            {/* Page Content */}
            {currentPage === 'database' && (
                <CustomerDatabase 
                    onBack={() => setCurrentPage('home')}
                    customers={customers}
                    orders={orders}
                    setOrders={setOrders}
                    loading={false}
                />
            )}

            {currentPage === 'staff' && (
                <StaffManagement 
                    onBack={() => setCurrentPage('home')}
                />
            )}

            {currentPage === 'home' && (
                <HomePage 
                    onOpenDatabase={() => setCurrentPage('database')}
                    customers={customers}
                    setCustomers={setCustomers}
                    orders={orders}
                    setOrders={setOrders}
                />
            )}
        </div>
    );
}

export default App;