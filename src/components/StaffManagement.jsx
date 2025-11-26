import React, { useState, useEffect, useCallback } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Table,
  Form,
  Modal,
  Badge,
} from "react-bootstrap";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  getDoc,
  where,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { Home, Plus, Trash2, Edit2, DollarSign } from "./Icons";
import LoadingOverlay from "./LoadingOverlay";

// --- CONFIGURATION ---
const workTypesConfig = {
  pant_maker: {
    label: "Pant Maker",
    fields: ["pant"],
    rateKeys: ["pantMakerCost"],
  },
  shirt_maker: {
    label: "Shirt Maker",
    fields: ["shirt"],
    rateKeys: ["shirtMakerCost"],
  },
  cutting_master: {
    label: "Cutting Master",
    fields: ["shirt", "pant"],
    rateKeys: ["shirtPieceCuttingCost", "pantPieceCuttingCost"],
  },
  iron_master: {
    label: "Iron Master",
    fields: ["shirt", "pant"],
    rateKeys: ["shirtIronCost", "pantIronCost"],
  },
  helper: { label: "Helper", fields: [], rateKeys: [] }, // Helper has no piece rates
};

const rateKeysConfig = {
  shirtMakerCost: { label: "Shirt Stitching Cost", default: 50 },
  pantMakerCost: { label: "Pant Stitching Cost", default: 60 },
  shirtIronCost: { label: "Shirt Ironing Cost", default: 5 },
  pantIronCost: { label: "Pant Ironing Cost", default: 8 },
  shirtPieceCuttingCost: { label: "Shirt Cutting Cost", default: 10 },
  pantPieceCuttingCost: { label: "Pant Cutting Cost", default: 15 },
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState({
    recordId: "",
    staffId: "",
    amount: "",
  });

  // Pagination state - filter by work type
  const [currentWorkType, setCurrentWorkType] = useState("pant_maker");

  const [newStaff, setNewStaff] = useState({
    name: "",
    workType: "pant_maker",
  });

  // Get staff filtered by current work type
  const filteredStaff = staffMembers.filter(
    (s) => s.workType === currentWorkType
  );
  const workTypesList = Object.keys(workTypesConfig);

  // Helper to get rates
  const getStaffRates = useCallback(
    (staff) => {
      const config = workTypesConfig[staff.workType];
      const rates = {};
      if (config) {
        config.rateKeys.forEach((key) => {
          rates[key] = globalRates[key] || 0;
        });
      }
      return {
        shirtRate:
          rates.shirtMakerCost ||
          rates.shirtIronCost ||
          rates.shirtPieceCuttingCost ||
          0,
        pantRate:
          rates.pantMakerCost ||
          rates.pantIronCost ||
          rates.pantPieceCuttingCost ||
          0,
      };
    },
    [globalRates]
  );

  const ensureTodayRecord = useCallback(async (staff, currentWorkRecords) => {
    const today = new Date().toISOString().split("T")[0];

    let todayRecord = currentWorkRecords.find((r) => r.date === today);

    if (!todayRecord && staff.length > 0) {
      const q = query(
        collection(db, "workRecords"),
        where("date", "==", today)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        todayRecord = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      }
    }

    if (!todayRecord && staff.length > 0) {
      const recordRef = doc(collection(db, "workRecords"));
      const newRecord = {
        id: recordRef.id,
        date: today,
        day: new Date().toLocaleDateString("en-US", { weekday: "long" }),
        work: {},
      };

      staff.forEach((s) => {
        newRecord.work[s.id] = {
          shirt: 0,
          pant: 0,
          earned: 0, // Auto-calculated
          paid: 0, // Manual entry
          balance: 0, // earned - paid
        };
      });

      await setDoc(recordRef, newRecord);
      setWorkRecords((prev) => [newRecord, ...prev]);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const ratesDoc = await getDoc(doc(db, "config", "globalRates"));
      const loadedRates = ratesDoc.exists() ? ratesDoc.data() : initialRates;
      setGlobalRates(loadedRates);
      setTempRates(loadedRates);

      const staffSnapshot = await getDocs(collection(db, "staff"));
      const staffData = staffSnapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      }));
      setStaffMembers(staffData);

      const recordsQuery = query(
        collection(db, "workRecords"),
        orderBy("date", "desc")
      );
      const recordsSnapshot = await getDocs(recordsQuery);
      const recordsData = recordsSnapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      }));
      setWorkRecords(recordsData);

      await ensureTodayRecord(staffData, recordsData);

      setLoading(false);
    } catch (error) {
      console.error("Error loading staff data:", error);
      setLoading(false);
      alert("Failed to load data");
    }
  }, [ensureTodayRecord]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateGlobalRates = async () => {
    try {
      setLoading(true);
      const rateRef = doc(db, "config", "globalRates");

      const ratesToSave = Object.fromEntries(
        Object.entries(tempRates).map(([key, value]) => [
          key,
          parseFloat(value) || 0,
        ])
      );

      await setDoc(rateRef, ratesToSave, { merge: true });

      setGlobalRates(ratesToSave);
      setShowRateSetter(false);
      setLoading(false);
    } catch (error) {
      console.error("Error updating rates:", error);
      alert("Failed to update global rates");
      setLoading(false);
    }
  };

  const addStaff = async () => {
    if (!newStaff.name.trim()) {
      alert("Please enter staff name");
      return;
    }

    try {
      setLoading(true);
      const staffRef = doc(collection(db, "staff"));
      const staffData = {
        id: staffRef.id,
        name: newStaff.name,
        workType: newStaff.workType,
        createdAt: new Date().toISOString(),
      };

      await setDoc(staffRef, staffData);

      for (const record of workRecords) {
        const recordRef = doc(db, "workRecords", record.id);
        await updateDoc(recordRef, {
          [`work.${staffRef.id}`]: {
            shirt: 0,
            pant: 0,
            earned: 0,
            paid: 0,
            balance: 0,
          },
        });
      }

      setNewStaff({ name: "", workType: "pant_maker" });
      setShowAddStaff(false);
      await loadData();
    } catch (error) {
      console.error("Error adding staff:", error);
      alert("Failed to add staff member");
    }
  };

  const deleteStaff = async (staffId) => {
    if (!window.confirm("Are you sure you want to delete this staff member?")) {
      return;
    }

    try {
      setLoading(true);
      await deleteDoc(doc(db, "staff", staffId));

      for (const record of workRecords) {
        const recordRef = doc(db, "workRecords", record.id);
        const updatedWork = { ...record.work };
        delete updatedWork[staffId];
        await updateDoc(recordRef, { work: updatedWork });
      }

      await loadData();
    } catch (error) {
      console.error("Error deleting staff:", error);
      alert("Failed to delete staff member");
    }
  };

  const updateWork = async (recordId, staffId, field, value) => {
    try {
      const staff = staffMembers.find((s) => s.id === staffId);
      const record = workRecords.find((r) => r.id === recordId);
      const work = record.work[staffId] || {
        shirt: 0,
        pant: 0,
        earned: 0,
        paid: 0,
        balance: 0,
      };

      // Update the field
      const updatedWork = {
        ...work,
        [field]: parseInt(value) || 0,
      };

      // Recalculate earned amount (only for non-helpers)
      if (staff.workType !== "helper") {
        const staffRates = getStaffRates(staff);
        updatedWork.earned =
          (updatedWork.shirt || 0) * staffRates.shirtRate +
          (updatedWork.pant || 0) * staffRates.pantRate;
      }

      // Recalculate balance
      updatedWork.balance = updatedWork.earned - (updatedWork.paid || 0);

      const recordRef = doc(db, "workRecords", recordId);
      await updateDoc(recordRef, {
        [`work.${staffId}`]: updatedWork,
      });

      setWorkRecords(
        workRecords.map((r) => {
          if (r.id === recordId) {
            return {
              ...r,
              work: {
                ...r.work,
                [staffId]: updatedWork,
              },
            };
          }
          return r;
        })
      );
    } catch (error) {
      console.error("Error updating work:", error);
      alert("Failed to update work count");
    }
  };

  const openPaymentModal = (recordId, staffId, currentPaid) => {
    setSelectedPayment({ recordId, staffId, amount: currentPaid || "" });
    setShowPaymentModal(true);
  };

  const savePayment = async () => {
    try {
      const { recordId, staffId, amount } = selectedPayment;
      const record = workRecords.find((r) => r.id === recordId);
      const work = record.work[staffId];

      const paidAmount = parseFloat(amount) || 0;
      const updatedWork = {
        ...work,
        paid: paidAmount,
        balance: (work.earned || 0) - paidAmount,
      };

      const recordRef = doc(db, "workRecords", recordId);
      await updateDoc(recordRef, {
        [`work.${staffId}`]: updatedWork,
      });

      setWorkRecords(
        workRecords.map((r) => {
          if (r.id === recordId) {
            return {
              ...r,
              work: {
                ...r.work,
                [staffId]: updatedWork,
              },
            };
          }
          return r;
        })
      );

      setShowPaymentModal(false);
      setSelectedPayment({ recordId: "", staffId: "", amount: "" });
    } catch (error) {
      console.error("Error saving payment:", error);
      alert("Failed to save payment");
    }
  };

  const calculateWeeklyStats = (staffId) => {
    const weekRecords = workRecords.slice(0, 7);
    return weekRecords.reduce(
      (stats, record) => {
        const work = record.work[staffId] || { earned: 0, paid: 0, balance: 0 };
        return {
          earned: stats.earned + (work.earned || 0),
          paid: stats.paid + (work.paid || 0),
          balance: stats.balance + (work.balance || 0),
        };
      },
      { earned: 0, paid: 0, balance: 0 }
    );
  };

  return (
    <Container fluid className="database-container">
      {loading && <LoadingOverlay message="Loading staff data..." />}

      {/* Header */}
      <Card className="database-header-card shadow-lg mb-4">
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h1 className="database-title mb-0">👷 Staff Management</h1>
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
                <Home size={24} className="me-2" />
              </Button>
            </div>
          </div>

          {/* Stats */}
          <Row className="g-3 mb-4">
            <Col xs={6} md={3}>
              <div className="stat-card stat-customers">
                <div className="stat-label">Total Staff</div>
                <div className="stat-value">{staffMembers.length}</div>
              </div>
            </Col>
            <Col xs={6} md={3}>
              <div className="stat-card stat-balance">
                <div className="stat-label">This Week Earned</div>
                <div className="stat-value">
                  ₹
                  {filteredStaff.reduce(
                    (sum, s) => sum + calculateWeeklyStats(s.id).earned,
                    0
                  )}
                </div>
              </div>
            </Col>
            <Col xs={6} md={3}>
              <div className="stat-card stat-pending">
                <div className="stat-label">This Week Paid</div>
                <div className="stat-value">
                  ₹
                  {filteredStaff.reduce(
                    (sum, s) => sum + calculateWeeklyStats(s.id).paid,
                    0
                  )}
                </div>
              </div>
            </Col>
            <Col xs={6} md={3}>
              <div className="stat-card stat-overdue">
                <div className="stat-label">Balance Due</div>
                <div className="stat-value">
                  ₹
                  {filteredStaff.reduce(
                    (sum, s) => sum + calculateWeeklyStats(s.id).balance,
                    0
                  )}
                </div>
              </div>
            </Col>
          </Row>

          {/* Work Type Filter/Pagination */}
          <div className="d-flex gap-2 flex-wrap">
            {workTypesList.map((type) => (
              <Button
                key={type}
                variant={
                  currentWorkType === type ? "primary" : "outline-primary"
                }
                onClick={() => setCurrentWorkType(type)}
                className="modern-btn"
              >
                {workTypesConfig[type].label}
                <Badge bg="light" text="dark" className="ms-2">
                  {staffMembers.filter((s) => s.workType === type).length}
                </Badge>
              </Button>
            ))}
          </div>
        </Card.Body>
      </Card>

      {/* Work Records Table */}
      <Card className="modern-card shadow-lg">
        <Card.Body className="p-4">
          <h4 className="mb-3">
            {workTypesConfig[currentWorkType].label} - Work Records
          </h4>

          {filteredStaff.length === 0 ? (
            <div className="text-center p-5 text-muted">
              <h5>No staff members in this category</h5>
              <p>Add staff members to start tracking their work</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table
                bordered
                hover
                className="mb-0"
                style={{ minWidth: "800px" }}
              >
                <thead
                  style={{
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                  }}
                >
                  <tr>
                    <th
                      style={{
                        minWidth: "120px",
                        position: "sticky",
                        left: 0,
                        background: "inherit",
                        zIndex: 10,
                      }}
                    >
                      Date & Day
                    </th>
                    {filteredStaff.map((staff) => {
                      const config = workTypesConfig[staff.workType];
                      return (
                        <th key={staff.id} style={{ minWidth: "250px" }}>
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <div className="fw-bold mb-1">{staff.name}</div>
                              <Badge bg="light" text="dark" className="mb-1">
                                {config.label}
                              </Badge>
                              {config.rateKeys.length > 0 && (
                                <div
                                  style={{ fontSize: "0.75rem", opacity: 0.9 }}
                                >
                                  {config.rateKeys.map((key) => (
                                    <div key={key}>
                                      {rateKeysConfig[key].label.split(" ")[0]}:
                                      ₹{globalRates[key] || 0}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => deleteStaff(staff.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Daily Records */}
                  {workRecords.slice(0, 7).map((record, index) => (
                    <tr key={record.id}>
                      <td
                        style={{
                          position: "sticky",
                          left: 0,
                          background: "white",
                          zIndex: 5,
                          borderRight: "2px solid #e2e8f0",
                        }}
                      >
                        <div className="fw-bold">
                          {new Date(record.date).toLocaleDateString("en-IN")}
                        </div>
                        <div className="text-muted small">{record.day}</div>
                      </td>
                      {filteredStaff.map((staff) => {
                        const work = record.work[staff.id] || {
                          shirt: 0,
                          pant: 0,
                          earned: 0,
                          paid: 0,
                          balance: 0,
                        };
                        const config = workTypesConfig[staff.workType];
                        const fields = config.fields;
                        const staffRates = getStaffRates(staff);

                        return (
                          <td
                            key={staff.id}
                            style={{
                              background: index % 2 === 0 ? "white" : "#f7fafc",
                            }}
                          >
                            <div className="d-flex flex-column gap-2">
                              {/* Work Count Inputs (only if not helper) */}
                              {fields.includes("shirt") && (
                                <div className="d-flex align-items-center gap-2">
                                  <span style={{ minWidth: "30px" }}>👔</span>
                                  <Form.Control
                                    type="number"
                                    size="sm"
                                    value={work.shirt || 0}
                                    onChange={(e) =>
                                      updateWork(
                                        record.id,
                                        staff.id,
                                        "shirt",
                                        e.target.value
                                      )
                                    }
                                    style={{ width: "70px" }}
                                  />
                                  <span className="text-muted small">
                                    ₹{(work.shirt || 0) * staffRates.shirtRate}
                                  </span>
                                </div>
                              )}
                              {fields.includes("pant") && (
                                <div className="d-flex align-items-center gap-2">
                                  <span style={{ minWidth: "30px" }}>👖</span>
                                  <Form.Control
                                    type="number"
                                    size="sm"
                                    value={work.pant || 0}
                                    onChange={(e) =>
                                      updateWork(
                                        record.id,
                                        staff.id,
                                        "pant",
                                        e.target.value
                                      )
                                    }
                                    style={{ width: "70px" }}
                                  />
                                  <span className="text-muted small">
                                    ₹{(work.pant || 0) * staffRates.pantRate}
                                  </span>
                                </div>
                              )}

                              {/* Payment Tracking */}
                              <div className="border-top pt-2">
                                <div className="d-flex justify-content-between mb-1">
                                  <small className="text-muted">Earned:</small>
                                  <strong>₹{work.earned || 0}</strong>
                                </div>
                                <div className="d-flex justify-content-between mb-1">
                                  <small className="text-muted">Paid:</small>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="p-0 text-primary fw-bold"
                                    onClick={() =>
                                      openPaymentModal(
                                        record.id,
                                        staff.id,
                                        work.paid
                                      )
                                    }
                                  >
                                    ₹{work.paid || 0}
                                  </Button>
                                </div>
                                <div className="d-flex justify-content-between">
                                  <small className="text-muted">Balance:</small>
                                  <strong
                                    className={
                                      work.balance > 0
                                        ? "text-danger"
                                        : "text-success"
                                    }
                                  >
                                    ₹{work.balance || 0}
                                  </strong>
                                </div>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Weekly Total Row */}
                  <tr style={{ background: "#f7fafc", fontWeight: "bold" }}>
                    <td
                      style={{
                        position: "sticky",
                        left: 0,
                        background: "#f7fafc",
                        zIndex: 5,
                      }}
                    >
                      📊 Weekly Total (7 days)
                    </td>
                    {filteredStaff.map((staff) => {
                      const stats = calculateWeeklyStats(staff.id);
                      return (
                        <td
                          key={staff.id}
                          className="text-center"
                          style={{ background: "#e6ffed" }}
                        >
                          <div className="d-flex flex-column gap-1">
                            <div>
                              <small className="text-muted d-block">
                                Earned
                              </small>
                              <strong
                                style={{ fontSize: "1.1rem", color: "#22543d" }}
                              >
                                ₹{stats.earned}
                              </strong>
                            </div>
                            <div>
                              <small className="text-muted d-block">Paid</small>
                              <strong
                                style={{ fontSize: "1.1rem", color: "#2563eb" }}
                              >
                                ₹{stats.paid}
                              </strong>
                            </div>
                            <div>
                              <small className="text-muted d-block">
                                Balance
                              </small>
                              <strong
                                style={{
                                  fontSize: "1.1rem",
                                  color:
                                    stats.balance > 0 ? "#dc2626" : "#16a34a",
                                }}
                              >
                                ₹{stats.balance}
                              </strong>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </Table>
            </div>
          )}
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
                onChange={(e) =>
                  setNewStaff({ ...newStaff, name: e.target.value })
                }
                placeholder="Enter staff name"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">Work Type</Form.Label>
              <Form.Select
                value={newStaff.workType}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, workType: e.target.value })
                }
              >
                {Object.entries(workTypesConfig).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <p className="text-muted small mt-3">
              {newStaff.workType === "helper"
                ? "Helpers have no piece rates. Track their daily payments manually."
                : 'Piece rates are managed centrally in "Set Rates" modal.'}
            </p>
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
      <Modal
        show={showRateSetter}
        onHide={() => setShowRateSetter(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <DollarSign size={20} className="me-2" />
            Global Rate Setter
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted">
            Set the piece rates for all work types here. These rates apply
            globally to all staff.
          </p>
          <Form>
            <Row className="g-3">
              {Object.entries(rateKeysConfig).map(([key, config]) => (
                <Col xs={6} key={key}>
                  <Form.Group>
                    <Form.Label className="fw-bold">
                      {config.label} (₹)
                    </Form.Label>
                    <Form.Control
                      type="number"
                      value={tempRates[key] || 0}
                      onChange={(e) =>
                        setTempRates({
                          ...tempRates,
                          [key]: e.target.value,
                        })
                      }
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

      {/* Payment Modal */}
      <Modal
        show={showPaymentModal}
        onHide={() => setShowPaymentModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>💰 Record Payment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label className="fw-bold">Amount Paid (₹)</Form.Label>
              <Form.Control
                type="number"
                value={selectedPayment.amount}
                onChange={(e) =>
                  setSelectedPayment({
                    ...selectedPayment,
                    amount: e.target.value,
                  })
                }
                placeholder="Enter amount paid"
                autoFocus
              />
              <Form.Text className="text-muted">
                Enter the actual amount you paid to this staff member for this
                day
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowPaymentModal(false)}
          >
            Cancel
          </Button>
          <Button variant="success" onClick={savePayment}>
            Save Payment
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
export default StaffManagement;
