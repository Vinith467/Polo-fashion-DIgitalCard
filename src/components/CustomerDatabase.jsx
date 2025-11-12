import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Badge } from 'react-bootstrap';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Home, Search, ChevronDown, ChevronUp, Cloud, Trash2 } from './Icons';
import LoadingOverlay from './LoadingOverlay';

function CustomerDatabase({ onBack, customers, orders, setOrders, loading }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCustomer, setExpandedCustomer] = useState(null);
    const [viewingPhoto, setViewingPhoto] = useState(null);
    const [filterMode, setFilterMode] = useState('all');
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 300) {
                setShowScrollTop(true);
            } else {
                setShowScrollTop(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    const getCustomerOrders = (customerId) => {
        return orders.filter(o => o.customerId === customerId).sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    };

    const isOrderOverdue = (order) => {
        if (!order.readyDate || order.delivered) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(order.readyDate) < today;
    };

    const getTotalPending = () => {
        return orders.filter(o => !o.delivered).reduce((sum, o) => sum + o.balance, 0);
    };

    const getPendingCount = () => {
        return orders.filter(o => !o.delivered).length;
    };

    const getOverdueCount = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return orders.filter(o => !o.delivered && o.readyDate && new Date(o.readyDate) < today).length;
    };

    const getFilteredCustomers = () => {
        let filtered = customers.filter(customer => 
            customer.phone.includes(searchQuery) || 
            customer.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (filterMode === 'pending') {
            filtered = filtered.filter(customer => {
                const customerOrders = getCustomerOrders(customer.id);
                return customerOrders.some(o => !o.delivered);
            });
        } else if (filterMode === 'overdue') {
            filtered = filtered.filter(customer => {
                const customerOrders = getCustomerOrders(customer.id);
                return customerOrders.some(o => isOrderOverdue(o));
            });
        }

        filtered.sort((a, b) => {
            const aOrders = getCustomerOrders(a.id);
            const bOrders = getCustomerOrders(b.id);
            
            if (aOrders.length === 0) return 1;
            if (bOrders.length === 0) return -1;
            
            const aMaxCard = Math.max(...aOrders.map(o => parseInt(o.cardNumber) || 0));
            const bMaxCard = Math.max(...bOrders.map(o => parseInt(o.cardNumber) || 0));
            
            return bMaxCard - aMaxCard;
        });

        return filtered;
    };

    const filteredCustomers = getFilteredCustomers();
    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterMode, searchQuery]);

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
        scrollToTop();
    };

    const toggleOrderStatus = async (orderId) => {
        try {
            const order = orders.find(o => o.id === orderId);
            const orderRef = doc(db, 'orders', orderId);
            await updateDoc(orderRef, {
                delivered: !order.delivered
            });
            
            const updatedOrders = orders.map(o => {
                if (o.id === orderId) {
                    return { ...o, delivered: !o.delivered };
                }
                return o;
            });
            setOrders(updatedOrders);
        } catch (error) {
            console.error('Error updating order:', error);
            alert('Failed to update order status');
        }
    };

    const deleteOrder = async (orderId, customerId) => {
        if (window.confirm('Are you sure you want to delete this order? This cannot be undone.')) {
            try {
                await deleteDoc(doc(db, 'orders', orderId));
                
                const updatedOrders = orders.filter(order => order.id !== orderId);
                setOrders(updatedOrders);
                
                const customerHasOrders = updatedOrders.some(o => o.customerId === customerId);
                if (!customerHasOrders) {
                    await deleteDoc(doc(db, 'customers', customerId));
                    window.location.reload();
                }
            } catch (error) {
                console.error('Error deleting order:', error);
                alert('Failed to delete order');
            }
        }
    };

    const getFilterTitle = () => {
        switch(filterMode) {
            case 'pending': return '📋 Pending Orders';
            case 'overdue': return '⚠️ Overdue Orders';
            default: return '👥 All Customers (Latest First)';
        }
    };

    return (
        <Container fluid className="database-container">
            {loading && <LoadingOverlay message="Loading data..." />}
            
            {showScrollTop && (
                <button
                    onClick={scrollToTop}
                    className="scroll-to-top-btn"
                    aria-label="Scroll to top"
                >
                    ↑
                </button>
            )}
            
            {viewingPhoto && (
                <div 
                    className="photo-modal"
                    onClick={() => setViewingPhoto(null)}
                >
                    <button
                        onClick={() => setViewingPhoto(null)}
                        className="photo-close-btn"
                    >
                        ✕
                    </button>
                    <img
                        src={viewingPhoto}
                        alt="Measurement Full View"
                        className="photo-modal-img"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
            
            <Card className="database-header-card shadow-lg mb-4">
                <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h1 className="database-title d-flex align-items-center gap-3 mb-0">
                            Customer History
                        </h1>
                        <Button
                            variant="primary"
                            className="modern-btn btn-home"
                            onClick={onBack}
                        >
                            <Home size={24} className="me-2" />
                            Home
                        </Button>
                    </div>

                    <Row className="g-3 mb-4">
                        <Col xs={6} md={3}>
                            <div className="stat-card stat-customers">
                                <div className="stat-label">Total Customers</div>
                                <div className="stat-value">{customers.length}</div>
                            </div>
                        </Col>
                        <Col xs={6} md={3}>
                            <div 
                                className={`stat-card stat-pending ${filterMode === 'pending' ? 'stat-active' : ''}`}
                                onClick={() => setFilterMode(filterMode === 'pending' ? 'all' : 'pending')}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="stat-label">Pending Orders</div>
                                <div className="stat-value">{getPendingCount()}</div>
                            </div>
                        </Col>
                        <Col xs={6} md={3}>
                            <div 
                                className={`stat-card stat-overdue ${filterMode === 'overdue' ? 'stat-active' : ''}`}
                                onClick={() => setFilterMode(filterMode === 'overdue' ? 'all' : 'overdue')}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="stat-label">⚠️ Overdue</div>
                                <div className="stat-value">{getOverdueCount()}</div>
                            </div>
                        </Col>
                        <Col xs={6} md={3}>
                            <div className="stat-card stat-balance">
                                <div className="stat-label">Total Balance</div>
                                <div className="stat-value">₹{getTotalPending()}</div>
                            </div>
                        </Col>
                    </Row>

                    {filterMode !== 'all' && (
                        <div className="filter-header mb-3 d-flex justify-content-between align-items-center">
                            <h3 className="mb-0">{getFilterTitle()}</h3>
                            <Button
                                variant="outline-light"
                                size="sm"
                                onClick={() => setFilterMode('all')}
                            >
                                ✕ Clear Filter
                            </Button>
                        </div>
                    )}

                    <div className="search-container position-relative">
                        <Form.Control
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="🔍︎ Search by name or phone number..."
                            className="search-input"
                            size="lg"
                        />
                        
                    </div>
                </Card.Body>
            </Card>

            <div className="customers-list">
                {paginatedCustomers.length === 0 ? (
                    <Card className="text-center p-5 empty-state">
                        <Card.Body>
                            <h3 className="text-muted">
                                {searchQuery 
                                    ? 'No customers found matching your search.' 
                                    : filterMode === 'pending'
                                    ? 'No pending orders! 🎉'
                                    : filterMode === 'overdue'
                                    ? 'No overdue orders! Great job! ✅'
                                    : 'No customers yet. Create your first bill!'}
                            </h3>
                        </Card.Body>
                    </Card>
                ) : (
                    <>
                        {paginatedCustomers.map(customer => {
                            const customerOrders = getCustomerOrders(customer.id);
                            const isExpanded = expandedCustomer === customer.id;
                            const pendingOrders = customerOrders.filter(o => !o.delivered);
                            const overdueOrders = customerOrders.filter(o => isOrderOverdue(o));
                            const totalBalance = pendingOrders.reduce((sum, o) => sum + o.balance, 0);

                            return (
                                <Card key={customer.id} className="customer-card shadow-lg mb-3">
                                    <Card.Body 
                                        className="customer-header p-4"
                                        onClick={() => setExpandedCustomer(isExpanded ? null : customer.id)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="d-flex justify-content-between align-items-start">
                                            <div className="flex-grow-1">
                                                <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                                                    <h3 className="customer-name mb-0">{customer.name}</h3>
                                                    {pendingOrders.length > 0 && (
                                                        <Badge bg="warning" className="badge-modern">
                                                            {pendingOrders.length} Pending
                                                        </Badge>
                                                    )}
                                                    {overdueOrders.length > 0 && (
                                                        <Badge bg="danger" className="badge-modern badge-pulse">
                                                            ⚠️ {overdueOrders.length} Overdue
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="customer-phone mb-2">📞 {customer.phone}</div>
                                                <div className="d-flex gap-3 flex-wrap customer-meta">
                                                    <span>Total Orders: <strong>{customerOrders.length}</strong></span>
                                                    {totalBalance > 0 && (
                                                        <span className="text-danger">Balance Due: <strong>₹{totalBalance}</strong></span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="chevron-icon">
                                                {isExpanded ? <ChevronUp size={28} /> : <ChevronDown size={28} />}
                                            </div>
                                        </div>
                                    </Card.Body>

                                    {isExpanded && customerOrders.length > 0 && (
                                        <div className="orders-section p-4">
                                            <h4 className="orders-title mb-3">Order History</h4>
                                            <Row className="g-3">
                                                {customerOrders.map(order => {
                                                    const orderIsOverdue = isOrderOverdue(order);
                                                    return (
                                                        <Col key={order.id} xs={12} md={6} lg={4}>
                                                            <Card className={`order-card ${orderIsOverdue ? 'order-overdue' : order.delivered ? 'order-delivered' : 'order-pending'}`}>
                                                                <div className="order-card-header">
                                                                    Card #{order.cardNumber}
                                                                </div>
                                                                
                                                                <Card.Body className="p-3">
                                                                    <div className="order-dates mb-2 pb-2 border-bottom">
                                                                        <div className="order-date-item">📅 {order.date}</div>
                                                                        {order.readyDate && (
                                                                            <div className={`order-date-item ${orderIsOverdue ? 'text-danger fw-bold' : ''}`}>
                                                                                ⏰ {order.readyDate} {orderIsOverdue && '⚠️'}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    <div className="order-amounts mb-2 pb-2 border-bottom">
                                                                        <div className="amount-row">
                                                                            <span>Total:</span>
                                                                            <span className="fw-bold">₹{order.total}</span>
                                                                        </div>
                                                                        <div className="amount-row">
                                                                            <span>Advance:</span>
                                                                            <span className="fw-bold">₹{order.advance}</span>
                                                                        </div>
                                                                        <div className="amount-row balance-row">
                                                                            <span>Balance:</span>
                                                                            <span className="fw-bold">₹{order.balance}</span>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <div className="order-items mb-2 pb-2 border-bottom">
                                                                        <div className="items-label fw-bold mb-1">Items:</div>
                                                                        {order.items.map((item, idx) => (
                                                                            <div key={idx} className="item-detail">
                                                                                {item.shirts && `👔 ${item.shirts}`}
                                                                                {item.shirts && item.pants && ' • '}
                                                                                {item.pants && `👖 ${item.pants}`}
                                                                                {(item.shirts || item.pants) && ` - ₹${item.amount}`}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    
                                                                    <div className="d-flex align-items-center justify-content-between">
                                                                        <div className="d-flex align-items-center gap-2">
                                                                            <Badge 
                                                                                bg={order.delivered ? 'success' : orderIsOverdue ? 'danger' : 'warning'}
                                                                                className="status-badge"
                                                                            >
                                                                                {order.delivered ? '✓' : orderIsOverdue ? '⚠️' : '⏳'}
                                                                            </Badge>
                                                                            
                                                                            {order.measurementPhoto && (
                                                                                <img
                                                                                    src={order.measurementPhoto}
                                                                                    alt="📸"
                                                                                    className="measurement-thumb"
                                                                                    onClick={() => setViewingPhoto(order.measurementPhoto)}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        
                                                                        <div className="d-flex gap-2 align-items-center">
                                                                            <Button
                                                                                variant="danger"
                                                                                size="sm"
                                                                                onClick={() => deleteOrder(order.id, order.customerId)}
                                                                                className="btn-delete-order"
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </Button>
                                                                            <label className="toggle-switch">
                                                                                <input 
                                                                                    type="checkbox" 
                                                                                    checked={order.delivered || false}
                                                                                    onChange={() => toggleOrderStatus(order.id)}
                                                                                />
                                                                                <span className="slider"></span>
                                                                            </label>
                                                                        </div>
                                                                    </div>
                                                                </Card.Body>
                                                            </Card>
                                                        </Col>
                                                    );
                                                })}
                                            </Row>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}

                        {totalPages > 1 && (
                            <div className="pagination-container">
                                <Button
                                    variant="outline-secondary"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="pagination-btn"
                                >
                                    ← Previous
                                </Button>
                                
                                <div className="pagination-info">
                                    Page {currentPage} of {totalPages} 
                                    <span className="text-muted ms-2">
                                        ({filteredCustomers.length} customers)
                                    </span>
                                </div>
                                
                                <Button
                                    variant="outline-secondary"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="pagination-btn"
                                >
                                    Next →
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </Container>
    );
}

export default CustomerDatabase;