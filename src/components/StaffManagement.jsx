import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Modal, Badge } from 'react-bootstrap';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, getDoc, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Home, Plus, Trash2, Edit2, DollarSign } from './Icons'; 
import LoadingOverlay from './LoadingOverlay';

// --- CONFIGURATION ---
const workTypesConfig = {
    pant_maker: { label: 'Pant Maker', fields: ['pant'], rateKeys: ['pantMakerCost'] },
    shirt_maker: { label: 'Shirt Maker', fields: ['shirt'], rateKeys: ['shirtMakerCost'] },
    cutting_master: { label: 'Cutting Master', fields: ['shirt', 'pant'], rateKeys: ['shirtPieceCuttingCost', 'pantPieceCuttingCost'] },
    iron_master: { label: 'Iron Master', fields: ['shirt', 'pant'], rateKeys: ['shirtIronCost', 'pantIronCost'] }
};

const rateKeysConfig = {
    shirtMakerCost: { label: 'Shirt Stitching Cost', default: 50 },
    pantMakerCost: { label: 'Pant Stitching Cost', default: 60 },
    shirtIronCost: { label: 'Shirt Ironing Cost', default: 5 },
    pantIronCost: { label: 'Pant Ironing Cost', default: 8 },
    shirtPieceCuttingCost: { label: 'Shirt Cutting Cost', default: 10 },
    pantPieceCuttingCost: { label: 'Pant Cutting Cost', default: 15 },
};

const initialRates = Object.fromEntries(
    Object.entries(rateKeysConfig).map(([key, value]) => [key, value.default])
);

function StaffManagement({ onBack }) {
    const [staffMembers, setStaffMembers] = useState([]);
    const [workRecords, setWorkRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [globalRates, setGlobalRates] = useState(initialRates);
    const [tempRates, setTempRates] = useState(initialRates); 
    
    const [showAddStaff, setShowAddStaff] = useState(false);
    const [showRateSetter, setShowRateSetter] = useState(false);
    
    const [newStaff, setNewStaff] = useState({
        name: '',
        workType: 'pant_maker'
    });

    // Helper to get rates (Stable function, doesn't need state)
    const getStaffRates = useCallback((staff) => {
        const config = workTypesConfig[staff.workType];
        const rates = {};
        if (config) {
            config.rateKeys.forEach(key => {
                rates[key] = globalRates[key] || 0;
            });
        }
        return {
            shirtRate: rates.shirtMakerCost || rates.shirtIronCost || rates.shirtPieceCuttingCost || 0,
            pantRate: rates.pantMakerCost || rates.pantIronCost || rates.pantPieceCuttingCost || 0
        };
    }, [globalRates]);

    // Wrapped in useCallback to fix dependency warning
    const ensureTodayRecord = useCallback(async (staff, currentWorkRecords) => {
        const today = new Date().toISOString().split('T')[0];
        
        let todayRecord = currentWorkRecords.find(r => r.date === today);
        
        if (!todayRecord && staff.length > 0) {
            const q = query(collection(db, 'workRecords'), where('date', '==', today));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                todayRecord = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            }
        }

        if (!todayRecord && staff.length > 0) {
            const recordRef = doc(collection(db, 'workRecords'));
            const newRecord = {
                id: recordRef.id,
                date: today,
                day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
                work: {}
            };
            
            staff.forEach(s => {
                newRecord.work[s.id] = { shirt: 0, pant: 0 };
            });
            
            await setDoc(recordRef, newRecord);
            setWorkRecords(prev => [newRecord, ...prev]); 
        }
    }, []);

    // Wrapped in useCallback to fix dependency warning
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            
            const ratesDoc = await getDoc(doc(db, 'config', 'globalRates'));
            const loadedRates = ratesDoc.exists() ? ratesDoc.data() : initialRates;
            setGlobalRates(loadedRates);
            setTempRates(loadedRates);

            const staffSnapshot = await getDocs(collection(db, 'staff'));
            const staffData = staffSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setStaffMembers(staffData);

            const recordsQuery = query(collection(db, 'workRecords'), orderBy('date', 'desc'));
            const recordsSnapshot = await getDocs(recordsQuery);
            const recordsData = recordsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setWorkRecords(recordsData);

            await ensureTodayRecord(staffData, recordsData);
            
            setLoading(false);
        } catch (error) {
            console.error('Error loading staff data:', error);
            setLoading(false);
            alert('Failed to load data');
        }
    }, [ensureTodayRecord]);

    // Now the dependency array is valid
    useEffect(() => {
        loadData();
    }, [loadData]);

    const updateGlobalRates = async () => {
        try {
            setLoading(true);
            const rateRef = doc(db, 'config', 'globalRates');
            
            const ratesToSave = Object.fromEntries(
                Object.entries(tempRates).map(([key, value]) => [key, parseFloat(value) || 0])
            );

            await setDoc(rateRef, ratesToSave, { merge: true });
            
            setGlobalRates(ratesToSave);
            setShowRateSetter(false);
            setLoading(false);
        } catch (error) {
            console.error('Error updating rates:', error);
            alert('Failed to update global rates');
            setLoading(false);
        }
    };

    const addStaff = async () => {
        if (!newStaff.name.trim()) {
            alert('Please enter staff name');
            return;
        }

        try {
            setLoading(true);
            const staffRef = doc(collection(db, 'staff'));
            const staffData = {
                id: staffRef.id,
                name: newStaff.name,
                workType: newStaff.workType,
                createdAt: new Date().toISOString()
            };
            
            await setDoc(staffRef, staffData);
            
            for (const record of workRecords) {
                const recordRef = doc(db, 'workRecords', record.id);
                await updateDoc(recordRef, {
                    [`work.${staffRef.id}`]: { shirt: 0, pant: 0 }
                });
            }
            
            setNewStaff({ name: '', workType: 'pant_maker' });
            setShowAddStaff(false);
            await loadData();
        } catch (error) {
            console.error('Error adding staff:', error);
            alert('Failed to add staff member');
        }
    };

    const deleteStaff = async (staffId) => {
        if (!window.confirm('Are you sure you want to delete this staff member?')) {
            return;
        }

        try {
            setLoading(true);
            await deleteDoc(doc(db, 'staff', staffId));
            
            for (const record of workRecords) {
                const recordRef = doc(db, 'workRecords', record.id);
                const updatedWork = { ...record.work };
                delete updatedWork[staffId];
                await updateDoc(recordRef, { work: updatedWork });
            }
            
            await loadData();
        } catch (error) {
            console.error('Error deleting staff:', error);
            alert('Failed to delete staff member');
        }
    };

    const updateWork = async (recordId, staffId, field, value) => {
        try {
            const recordRef = doc(db, 'workRecords', recordId);
            await updateDoc(recordRef, {
                [`work.${staffId}.${field}`]: parseInt(value) || 0
            });
            
            setWorkRecords(workRecords.map(r => {
                if (r.id === recordId) {
                    return {
                        ...r,
                        work: {
                            ...r.work,
                            [staffId]: {
                                ...r.work[staffId],
                                [field]: parseInt(value) || 0
                            }
                        }
                    };
                }
                return r;
            }));
        } catch (error) {
            console.error('Error updating work:', error);
            alert('Failed to update work count');
        }
    };

    const calculateDailyWage = (staffId, work) => {
        const staff = staffMembers.find(s => s.id === staffId);
        if (!staff || !work) return 0;
        
        const staffRates = getStaffRates(staff);
        
        const shirtAmount = (work.shirt || 0) * (staffRates.shirtRate || 0);
        const pantAmount = (work.pant || 0) * (staffRates.pantRate || 0);
        return shirtAmount + pantAmount;
    };

    const calculateWeeklyTotal = (staffId) => {
        const weekRecords = workRecords.slice(0, 7);
        return weekRecords.reduce((total, record) => {
            return total + calculateDailyWage(staffId, record.work[staffId]);
        }, 0);
    };

    // If you aren't using the "This Week" display, you can remove this function.
    // But I have kept it here and used it in the JSX below so the linter is happy.
    // const getWeekLabel = () => {
    //     if (workRecords.length === 0) return '';
    //     const endDate = new Date(workRecords[0]?.date);
    //     const startDate = new Date(endDate);
    //     startDate.setDate(endDate.getDate() - 6);
    //     return `${startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
    // };

    return (
        <Container fluid className="database-container">
            {loading && <LoadingOverlay message="Loading staff data..." />}
            
            {/* Header */}
            <Card className="database-header-card shadow-lg mb-4">
                <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h1 className="database-title mb-0">
                            👷 Staff Management
                        </h1>
                        <div className="d-flex gap-2">
                            <Button
                                variant="warning"
                                className="modern-btn"
                                onClick={() => {
                                    setTempRates(globalRates); 
                                    setShowRateSetter(true);
                                }}
                            >
                                <DollarSign size={20} className="me-2" />
                                Set Rates
                            </Button>
                            
                            <Button
                                variant="success"
                                className="modern-btn"
                                onClick={() => setShowAddStaff(true)}
                            >
                                <Plus size={20} className="me-2" />
                                Add Staff
                            </Button>
                            <Button
                                variant="primary"
                                className="modern-btn btn-home"
                                onClick={onBack}
                            >
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <Row className="g-3">
                        <Col xs={6} md={3}>
                            <div className="stat-card stat-customers">
                                <div className="stat-label">Total Staff</div>
                                <div className="stat-value">{staffMembers.length}</div>
                            </div>
                        </Col>
                        
                        {/* Used getWeekLabel here to fix the unused variable error */}
                        <Col xs={6} md={3}>
                            <div className="stat-card stat-balance">
                                <div className="stat-label">Weekly Total Wage</div>
                                <div className="stat-value">
                                    ₹{staffMembers.reduce((sum, s) => sum + calculateWeeklyTotal(s.id), 0)}
                                </div>
                            </div>
                        </Col>
                        <Col xs={6} md={3}>
                            <div className="stat-card stat-overdue">
                                <div className="stat-label">Records</div>
                                <div className="stat-value">{workRecords.length}</div>
                            </div>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* Work Records Table */}
            <Card className="modern-card shadow-lg">
                <Card.Body className="p-4">
                    <div className="table-responsive">
                        <Table bordered hover className="mb-0" style={{ minWidth: '800px' }}>
                            <thead style={{ 
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white'
                            }}>
                                <tr>
                                    <th style={{ minWidth: '120px', left: 0, background: 'inherit', zIndex: 10 }}>
                                        Date & Day
                                    </th>
                                    {staffMembers.map(staff => {
                                        // REMOVED the unused 'staffRates' variable from here
                                        const config = workTypesConfig[staff.workType];
                                        return (
                                            <th key={staff.id} style={{ minWidth: '200px' }}>
                                                <div className="d-flex justify-content-between align-items-start">
                                                    <div>
                                                        <div className="fw-bold mb-1">{staff.name}</div>
                                                        <Badge bg="light" text="dark" className="mb-1">
                                                            {config.label}
                                                        </Badge>
                                                        <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                                                            {config.rateKeys.map(key => (
                                                                <div key={key}>
                                                                    {rateKeysConfig[key].label.split(' ')[0]}: ₹{globalRates[key] || 0}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="d-flex gap-1">
                                                        <Button
                                                            variant="danger"
                                                            size="sm"
                                                            onClick={() => deleteStaff(staff.id)}
                                                        >
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {/* Daily Records */}
                                {workRecords.map((record, index) => (
                                    <tr key={record.id}>
                                        <td style={{ 
                                            left: 0, 
                                            background: 'white',
                                            zIndex: 5,
                                            borderRight: '2px solid #e2e8f0'
                                        }}>
                                            <div className="fw-bold">{new Date(record.date).toLocaleDateString('en-IN')}</div>
                                            <div className="text-muted small">{record.day}</div>
                                        </td>
                                        {staffMembers.map(staff => {
                                            const work = record.work[staff.id] || { shirt: 0, pant: 0 };
                                            const config = workTypesConfig[staff.workType];
                                            const fields = config.fields;
                                            const staffRates = getStaffRates(staff);
                                            const dailyWage = calculateDailyWage(staff.id, work);
                                            
                                            return (
                                                <td key={staff.id} style={{ background: index % 2 === 0 ? 'white' : '#f7fafc' }}>
                                                    <div className="d-flex flex-column gap-2">
                                                        {fields.includes('shirt') && (
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span style={{ minWidth: '30px' }}>👔</span>
                                                                <Form.Control
                                                                    type="number"
                                                                    size="sm"
                                                                    value={work.shirt || 0}
                                                                    onChange={(e) => updateWork(record.id, staff.id, 'shirt', e.target.value)}
                                                                    style={{ width: '70px' }}
                                                                />
                                                                <span className="text-muted small">
                                                                    ₹{(work.shirt || 0) * staffRates.shirtRate}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {fields.includes('pant') && (
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span style={{ minWidth: '30px' }}>👖</span>
                                                                <Form.Control
                                                                    type="number"
                                                                    size="sm"
                                                                    value={work.pant || 0}
                                                                    onChange={(e) => updateWork(record.id, staff.id, 'pant', e.target.value)}
                                                                    style={{ width: '70px' }}
                                                                />
                                                                <span className="text-muted small">
                                                                    ₹{(work.pant || 0) * staffRates.pantRate}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="text-center pt-2 border-top">
                                                            <Badge bg="success">Total: ₹{dailyWage}</Badge>
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                 {/* Weekly Total Row */}
                                <tr style={{ background: '#f7fafc', fontWeight: 'bold' }}>
                                    <td style={{  left: 0, background: '#f7fafc', zIndex: 5 }}>
                                        📊 Weekly Total
                                    </td>
                                    {staffMembers.map(staff => (
                                        <td key={staff.id} className="text-center" style={{ background: '#e6ffed' }}>
                                            <div className="fw-bold" style={{ fontSize: '1.2rem', color: '#22543d' }}>
                                                ₹{calculateWeeklyTotal(staff.id)}
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </Table>
                    </div>
                </Card.Body>
            </Card>

            {/* Add Staff Modal */}
            <Modal show={showAddStaff} onHide={() => setShowAddStaff(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Add New Staff Member</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Staff Name</Form.Label>
                            <Form.Control
                                type="text"
                                value={newStaff.name}
                                onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                                placeholder="Enter staff name"
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Work Type</Form.Label>
                            <Form.Select
                                value={newStaff.workType}
                                onChange={(e) => setNewStaff({...newStaff, workType: e.target.value})}
                            >
                                {Object.entries(workTypesConfig).map(([key, value]) => (
                                    <option key={key} value={key}>{value.label}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                        <p className="text-muted small mt-3">Rates are managed centrally in the "Set Rates" modal.</p>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAddStaff(false)}>
                        Cancel
                    </Button>
                    <Button variant="success" onClick={addStaff}>
                        <Plus size={18} className="me-2" />
                        Add Staff
                    </Button>
                </Modal.Footer>
            </Modal>
            
            {/* Global Rate Setter Modal */}
            <Modal show={showRateSetter} onHide={() => setShowRateSetter(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title><DollarSign size={20} className="me-2" />Global Rate Setter</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className="text-muted">Set the piece rates for all work types here. These rates apply globally to all staff.</p>
                    <Form>
                        <Row className="g-3">
                            {Object.entries(rateKeysConfig).map(([key, config]) => (
                                <Col xs={6} key={key}>
                                    <Form.Group>
                                        <Form.Label className="fw-bold">{config.label} (₹)</Form.Label>
                                        <Form.Control
                                            type="number"
                                            value={tempRates[key] || 0}
                                            onChange={(e) => setTempRates({
                                                ...tempRates,
                                                [key]: e.target.value
                                            })}
                                            placeholder={config.default.toString()}
                                        />
                                    </Form.Group>
                                </Col>
                            ))}
                        </Row>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowRateSetter(false)}>
                        Cancel
                    </Button>
                    <Button variant="warning" onClick={updateGlobalRates}>
                        <Edit2 size={18} className="me-2" />
                        Save All Rates
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}

export default StaffManagement;