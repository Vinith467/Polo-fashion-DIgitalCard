import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './services/firebase';
import HomePage from './components/HomePage';
import CustomerDatabase from './components/CustomerDatabase';
import LoadingOverlay from './components/LoadingOverlay';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
    const [currentPage, setCurrentPage] = useState('home');
    const [customers, setCustomers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

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

                setLoading(false);
            } catch (error) {
                console.error('Error loading data:', error);
                setLoading(false);
                alert('Failed to load data from cloud. Please refresh the page.');
            }
        };

        loadData();
    }, []);

    if (loading) {
        return <LoadingOverlay message="Loading from cloud..." />;
    }

    if (currentPage === 'database') {
        return (
            <CustomerDatabase 
                onBack={() => setCurrentPage('home')}
                customers={customers}
                orders={orders}
                setOrders={setOrders}
                loading={false}
            />
        );
    }

    return (
        <HomePage 
            onOpenDatabase={() => setCurrentPage('database')}
            customers={customers}
            setCustomers={setCustomers}
            orders={orders}
            setOrders={setOrders}
        />
    );
}

export default App;