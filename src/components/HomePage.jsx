import React, { useState, useRef } from 'react';
import { Container, Row, Col, Form, Button, Card } from 'react-bootstrap';
import html2canvas from 'html2canvas';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { uploadToCloudinary, compressImage } from '../services/cloudinary';
import { Download, Share2, MessageSquare, Plus, Trash2, Users, Clock, Cloud } from './Icons';
import LoadingOverlay from './LoadingOverlay';

function HomePage({ customers, setCustomers, orders, setOrders }) {
    const [cardNumber, setCardNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [readyDate, setReadyDate] = useState('');
    const [items, setItems] = useState([{ shirts: '', pants: '', amount: '' }]);
    const [advance, setAdvance] = useState('');
    const [showCustomers, setShowCustomers] = useState(false);
    const [setSelectedCustomer] = useState(null);
    const [measurementPhoto, setMeasurementPhoto] = useState(null);
    const [measurementPhotoFile, setMeasurementPhotoFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const billRef = useRef(null);
    const fileInputRef = useRef(null);

    const addItem = () => {
        setItems([...items, { shirts: '', pants: '', amount: '' }]);
    };

    const removeItem = (index) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const updateItem = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    };

    const calculateBalance = () => {
        const total = calculateTotal();
        const adv = parseFloat(advance) || 0;
        return total - adv;
    };

    const searchCustomers = (phone) => {
        if (phone.length >= 3) {
            return customers.filter(c => c.phone.includes(phone));
        }
        return [];
    };

    const selectCustomer = (customer) => {
        setPhoneNumber(customer.phone);
        setCustomerName(customer.name);
        setSelectedCustomer(customer);
        setShowCustomers(false);
    };

    const handlePhotoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setMeasurementPhotoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setMeasurementPhoto(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const removePhoto = () => {
        setMeasurementPhoto(null);
        setMeasurementPhotoFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const saveOrder = async () => {
        try {
            setLoading(true);
            
            let photoUrl = null;
            if (measurementPhotoFile) {
                try {
                    const compressedBlob = await compressImage(measurementPhotoFile, 1200, 0.9);
                    photoUrl = await uploadToCloudinary(compressedBlob);
                } catch (photoError) {
                    console.error('Photo upload error:', photoError);
                    alert('Warning: Photo upload failed. Order will be saved without photo.');
                }
            }

            let customer = customers.find(c => c.phone === phoneNumber);
            
            if (!customer) {
                const customerRef = doc(collection(db, 'customers'));
                customer = {
                    id: customerRef.id,
                    name: customerName,
                    phone: phoneNumber,
                    createdAt: new Date().toISOString()
                };
                await setDoc(customerRef, customer);
                setCustomers([...customers, customer]);
            } else {
                if (customer.name !== customerName) {
                    const customerRef = doc(db, 'customers', customer.id);
                    await updateDoc(customerRef, { name: customerName });
                    const updatedCustomers = customers.map(c => 
                        c.phone === phoneNumber ? { ...c, name: customerName } : c
                    );
                    setCustomers(updatedCustomers);
                }
            }

            const orderRef = doc(collection(db, 'orders'));
            const order = {
                id: orderRef.id,
                cardNumber,
                customerId: customer.id,
                customerName: customerName,
                customerPhone: customer.phone,
                date,
                readyDate,
                items: [...items],
                total: calculateTotal(),
                advance: parseFloat(advance) || 0,
                balance: calculateBalance(),
                delivered: false,
                measurementPhoto: photoUrl,
                createdAt: new Date().toISOString()
            };

            await setDoc(orderRef, order);
            setOrders([...orders, order]);
            
            setLoading(false);
            return order;
        } catch (error) {
            setLoading(false);
            console.error('Error saving order:', error);
            
            if (error.code === 'permission-denied') {
                alert('❌ Firebase Permission Error!\n\nPlease update Firebase security rules:\n1. Go to Firebase Console\n2. Firestore Database → Rules\n3. Set: allow read, write: if true;\n4. Publish');
            } else {
                alert('Failed to save order: ' + error.message);
            }
            throw error;
        }
    };

    const downloadBill = async () => {
        const element = billRef.current;
        
        const originalWidth = element.style.width;
        element.style.width = '600px';
        
        const canvas = await html2canvas(element, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            width: 600,
            windowWidth: 600
        });
        
        element.style.width = originalWidth;

        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Bill_${cardNumber || 'new'}_${date}.png`;
            link.click();
            URL.revokeObjectURL(url);
        });
    };

    const shareBill = async () => {
        if (!phoneNumber || phoneNumber.length < 10) {
            alert('10 ಅಂಕಿಯ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ\nPlease enter customer phone number (10 digits)');
            return;
        }

        try {
            await saveOrder();
            await downloadBill();

            setTimeout(() => {
                let formattedPhone = phoneNumber.replace(/\D/g, '');
                if (formattedPhone.length === 10) {
                    formattedPhone = '91' + formattedPhone;
                }

                const readyDateText = readyDate ? `\nReady By: ${readyDate}` : '';
                const message = `Hi ${customerName}! Your bill from Polo Fashions is ready.\n\nCard No: ${cardNumber}\nDate: ${date}${readyDateText}\nTotal: ₹${calculateTotal()}\nAdvance: ₹${advance || 0}\nBalance: ₹${calculateBalance()}\n\n🧾 Your digital Card is generated. Please check it once.\n\nThank you for choosing Polo Fashions!`;

                const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
                window.location.href = whatsappUrl;
            }, 1000);
        } catch (error) {
            console.error('Error sharing bill:', error);
        }
    };

    const shareSMS = async () => {
        if (!phoneNumber || phoneNumber.length < 10) {
            alert('10 ಅಂಕಿಯ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ\nPlease enter customer phone number (10 digits)');
            return;
        }

        try {
            await saveOrder();

            let formattedPhone = phoneNumber.replace(/\D/g, '');
            if (formattedPhone.length === 10) {
                formattedPhone = '+91' + formattedPhone;
            }

            const readyDateText = readyDate ? `\nReady By: ${readyDate}` : '';
            const message = `Hi ${customerName}! Your bill from Polo Fashions is ready.\n\nCard No: ${cardNumber}\nDate: ${date}${readyDateText}\nTotal: Rs.${calculateTotal()}\nAdvance: Rs.${advance || 0}\nBalance: Rs.${calculateBalance()}\n\nYour digital Card is generated.\n\nPolo Fashions\nMob: 9742445626`;

            const smsUrl = `sms:${formattedPhone}?body=${encodeURIComponent(message)}`;
            window.location.href = smsUrl;
        } catch (error) {
            console.error('Error sharing SMS:', error);
        }
    };

    const clearForm = () => {
        setCardNumber('');
        setCustomerName('');
        setPhoneNumber('');
        setDate(new Date().toISOString().split('T')[0]);
        setReadyDate('');
        setItems([{ shirts: '', pants: '', amount: '' }]);
        setAdvance('');
        setSelectedCustomer(null);
        setMeasurementPhoto(null);
        setMeasurementPhotoFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const isOverdue = () => {
        if (!readyDate) return false;
        return new Date(readyDate) < new Date();
    };

    return (
        <Container fluid className="app-container">
            {loading && <LoadingOverlay message="Saving to cloud..." />}
            
            <Row className="g-4">
                <Col lg={6}>
                    <Card className="modern-card shadow-lg">
                        <Card.Body className="p-4">
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h1 className="page-title d-flex align-items-center gap-2 mb-0">
                                     Polo Fashions
                                </h1>
                                
                            </div>

                            <div className="form-sections">
                                {/* Card Number */}
                                <div className="form-card card-number-card">
                                    <Form.Label className="form-label-modern">📋 Card Number</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={cardNumber}
                                        onChange={(e) => setCardNumber(e.target.value)}
                                        className="input-modern text-center"
                                        placeholder="123"
                                        size="lg"
                                    />
                                </div>

                                {/* Customer Name */}
                                <div className="form-card customer-name-card">
                                    <Form.Label className="form-label-modern">👤 Customer Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        className="input-modern text-center"
                                        placeholder="Enter name"
                                        size="lg"
                                    />
                                </div>

                                {/* Phone Number */}
                                <div className="form-card phone-card position-relative">
                                    <Form.Label className="form-label-modern">📞 Customer Phone Number</Form.Label>
                                    <Form.Control
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => {
                                            setPhoneNumber(e.target.value);
                                            setShowCustomers(e.target.value.length >= 3);
                                        }}
                                        className="input-modern text-center"
                                        placeholder="9876543210"
                                        maxLength="10"
                                        size="lg"
                                    />
                                    {showCustomers && searchCustomers(phoneNumber).length > 0 && (
                                        <div className="customer-suggestion">
                                            {searchCustomers(phoneNumber).map(customer => (
                                                <div
                                                    key={customer.id}
                                                    className="customer-item"
                                                    onClick={() => selectCustomer(customer)}
                                                >
                                                    <div className="fw-bold">{customer.name}</div>
                                                    <div className="text-muted small">{customer.phone}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Dates */}
                                <Row className="g-3">
                                    <Col md={6}>
                                        <Form.Label className="form-label-modern">📅 Order Date</Form.Label>
                                        <Form.Control
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="input-modern"
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <div className={isOverdue() ? 'overdue-warning' : ''}>
                                            <Form.Label className="form-label-modern d-flex align-items-center gap-2">
                                                <Clock size={20} />
                                                Delivery Date {isOverdue() && <span className="text-danger fw-bold">⚠️</span>}
                                            </Form.Label>
                                            <Form.Control
                                                type="date"
                                                value={readyDate}
                                                onChange={(e) => setReadyDate(e.target.value)}
                                                className={`input-modern ${isOverdue() ? 'border-danger' : ''}`}
                                            />
                                        </div>
                                    </Col>
                                </Row>

                                {/* Photo Upload */}
                                <div className="form-card photo-card">
                                    <Form.Label className="form-label-modern">
                                        Measurement Photo
                                    </Form.Label>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handlePhotoUpload}
                                        className="d-none"
                                        id="photoUpload"
                                    />
                                    {!measurementPhoto ? (
                                        <Form.Label
                                            htmlFor="photoUpload"
                                            className="btn btn-photo w-100 mb-0"
                                        >
                                            📷 Take/Upload Photo
                                        </Form.Label>
                                    ) : (
                                        <div>
                                            <img
                                                src={measurementPhoto}
                                                alt="Measurement"
                                                className="img-fluid rounded mb-2 photo-preview"
                                            />
                                            <Button
                                                variant="danger"
                                                className="w-100"
                                                onClick={removePhoto}
                                            >
                                                Remove Photo
                                            </Button>
                                            <div className="text-center text-muted small mt-2">
                                                ☁️ Will upload in HIGH QUALITY (1200px, 90% quality) to Cloudinary
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Items */}
                                <div className="items-section">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <Form.Label className="form-label-modern mb-0">🛍️ Items</Form.Label>
                                        <Button
                                            variant="success"
                                            size="sm"
                                            onClick={addItem}
                                            className="btn-add-item"
                                        >
                                            <Plus size={18} className="me-1" /> Add
                                        </Button>
                                    </div>

                                    {items.map((item, index) => (
                                        <Row key={index} className="g-2 mb-2 item-row">
                                            <Col xs={4}>
                                                <Form.Control
                                                    type="text"
                                                    value={item.shirts}
                                                    onChange={(e) => updateItem(index, 'shirts', e.target.value)}
                                                    placeholder="Shirts"
                                                    className="item-input"
                                                />
                                            </Col>
                                            <Col xs={4}>
                                                <Form.Control
                                                    type="text"
                                                    value={item.pants}
                                                    onChange={(e) => updateItem(index, 'pants', e.target.value)}
                                                    placeholder="Pants"
                                                    className="item-input"
                                                />
                                            </Col>
                                            <Col xs={3}>
                                                <Form.Control
                                                    type="number"
                                                    value={item.amount}
                                                    onChange={(e) => updateItem(index, 'amount', e.target.value)}
                                                    placeholder="₹"
                                                    className="item-input fw-bold"
                                                />
                                            </Col>
                                            <Col xs={1}>
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => removeItem(index)}
                                                    disabled={items.length === 1}
                                                    className="w-100 h-100"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </Col>
                                        </Row>
                                    ))}
                                </div>

                                {/* Totals */}
                                <Row className="g-2">
                                    <Col xs={4}>
                                        <div className="total-card total-amount">
                                            <div className="total-label">Total</div>
                                            <div className="total-value">₹{calculateTotal().toFixed(0)}</div>
                                        </div>
                                    </Col>
                                    <Col xs={4}>
                                        <div className="total-card advance-amount">
                                            <div className="total-label">Advance</div>
                                            <Form.Control
                                                type="number"
                                                value={advance}
                                                onChange={(e) => setAdvance(e.target.value)}
                                                className="advance-input"
                                                placeholder="0"
                                            />
                                        </div>
                                    </Col>
                                    <Col xs={4}>
                                        <div className="total-card balance-amount">
                                            <div className="total-label">Balance</div>
                                            <div className="total-value">₹{calculateBalance().toFixed(0)}</div>
                                        </div>
                                    </Col>
                                </Row>
                            </div>

                            {/* Action Buttons */}
                            <Row className="g-2 mt-3">
                                <Col xs={6}>
                                    <Button
                                        variant="primary"
                                        className="w-100 action-btn btn-download"
                                        onClick={downloadBill}
                                    >
                                        <Download size={20} />
                                        <span>Download</span>
                                    </Button>
                                </Col>
                                <Col xs={6}>
                                    <Button
                                        variant="secondary"
                                        className="w-100 action-btn btn-clear"
                                        onClick={clearForm}
                                    >
                                        <Trash2 size={20} />
                                        <span>Clear All</span>
                                    </Button>
                                </Col>
                                <Col xs={6}>
                                    <Button
                                        variant="success"
                                        className="w-100 action-btn btn-whatsapp"
                                        onClick={shareBill}
                                    >
                                        <Share2 size={20} />
                                        <span>WhatsApp</span>
                                    </Button>
                                </Col>
                                <Col xs={6}>
                                    <Button
                                        variant="info"
                                        className="w-100 action-btn btn-sms"
                                        onClick={shareSMS}
                                    >
                                        <MessageSquare size={20} />
                                        <span>SMS</span>
                                    </Button>
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                </Col>

                {/* Bill Preview */}
                <Col lg={6}>
                    <div className="bill-preview-section">
                        <h2 className="preview-title text-center mb-4">
                            Card Preview
                        </h2>
                        <div ref={billRef} className="bill-card">
                            <div className="bill-warning">
                                ✋ We are not responsible for stitched cloths after 3 Months
                            </div>
                            
                            <div className="bill-header">
                                <div className="shop-name">ಪೋಲೋ ಫ್ಯಾಷನ್ಸ್</div>
                                <div className="card-number-display">Card no: {cardNumber || '___'}</div>
                                <div className="customer-name-display">{customerName || 'Customer Name'}</div>
                                <div className="phone-display">📞 {phoneNumber || '___________'}</div>
                                <div className="date-display">📅 Date: {date}</div>
                                {readyDate && (
                                    <div className={`ready-date-display ${isOverdue() ? 'overdue' : ''}`}>
                                        ⏰ Ready By: {readyDate}
                                    </div>
                                )}
                            </div>

                            <div className="bill-table-container">
                                <table className="bill-table">
                                    <thead>
                                        <tr>
                                            <th>Sr.</th>
                                            <th>SHIRTS</th>
                                            <th>PANTS</th>
                                            <th>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, index) => (
                                            <tr key={index}>
                                                <td>{index + 1}</td>
                                                <td>{item.shirts}</td>
                                                <td>{item.pants}</td>
                                                <td className="fw-bold">₹{item.amount}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bill-summary">
                                <div className="summary-row">
                                    <span>Total:</span>
                                    <span>₹{calculateTotal().toFixed(0)}</span>
                                </div>
                                <div className="summary-row">
                                    <span>Advance:</span>
                                    <span>₹{advance || '0'}</span>
                                </div>
                                <div className="summary-row balance-row">
                                    <span>Balance:</span>
                                    <span>₹{calculateBalance().toFixed(0)}</span>
                                </div>
                            </div>

                            <div className="bill-footer">
                                <div className="footer-shop-name">POLO FASHIONS</div>
                                <div className="footer-tagline">
                                    Get Your Dress Ready in as soon as 1–2 Hours – Only at Polo Fashions!
                                </div>
                                <div className="footer-address">
                                    #GF-30, Anjuman-Eslamiya Complex,<br />
                                    T.V.S. Road<br />
                                    Kollegal-571 440
                                </div>
                                <div className="footer-phone">Mob: 9742445626</div>
                            </div>
                        </div>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default HomePage;