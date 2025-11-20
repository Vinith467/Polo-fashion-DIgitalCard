import { Navbar, Nav, NavDropdown, Container } from "react-bootstrap";
import { Users, Briefcase, Home } from "./Icons";

function NavigationBar({ currentPage, onNavigate }) {
  // Define a reusable style object for NavDropdown items for cleaner code
  const dropdownItemStyle = {
    padding: "12px 18px", // More generous padding
    transition: 'background-color 0.2s, border-left 0.2s', // Added transition for border
  };

  return (
    <Navbar
      bg="dark"
      variant="dark"
      expand="lg"
      className="mb-4"
      style={{
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <Container fluid>
        <Navbar.Brand
          style={{
            fontSize: "1.5rem",
            fontWeight: "800",
            cursor: "pointer",
            display: 'flex',
            alignItems: 'center',
          }}
          onClick={() => onNavigate("home")}
        >
          <div className="footer-shop-name">
            <img
              src="/fav-icon.png"
              alt="Shop Icon"
              style={{ width: "40px", height: "40px", borderRadius: '6px' }} 
            />
          </div>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="navbar-nav" />
        <Navbar.Collapse id="navbar-nav">
          <Nav className="ms-auto">
            
            {/* --- HOME LINK REMOVED as requested --- */}

            {/* --- IMPROVED MANAGEMENT DROPDOWN --- */}
            <NavDropdown
              title={
                <span
                  style={{
                    fontWeight: "700", // Bolder text
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "0.5rem 1rem", 
                  }}
                >
                  <Briefcase size={20} /> {/* Changed icon to Briefcase for management */}
                  Management
                </span>
              }
              id="management-dropdown"
              align="end"
              menuVariant="light" // Dark text on light menu background
            >
              
              {/* Customer History Item - Enhanced */}
              <NavDropdown.Item
                onClick={() => onNavigate("database")}
                style={{
                  ...dropdownItemStyle,
                  // Visually highlight active page within dropdown
                  backgroundColor: currentPage === "database" ? '#e9f2ff' : 'transparent',
                  borderLeft: currentPage === "database" ? '4px solid #007bff' : '4px solid transparent',
                  // Added custom hover state using inline style logic for immediate feedback
                  '--bs-nav-link-hover-color': '#007bff',
                  '--bs-dropdown-link-hover-bg': '#f0f6ff',
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <Users size={24} style={{ color: '#007bff' }} /> 
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "16px", lineHeight: "1.2", color: '#333' }}>Customer History</div>
                    <small style={{ fontSize: "12px", color: '#6c757d' }}>View customer details and order logs.</small>
                  </div>
                </div>
              </NavDropdown.Item>
              
              <NavDropdown.Divider style={{ margin: '4px 0' }} />
              
              {/* Staff Management Item - Enhanced */}
              <NavDropdown.Item
                onClick={() => onNavigate("staff")}
                style={{
                  ...dropdownItemStyle,
                  backgroundColor: currentPage === "staff" ? '#e6ffed' : 'transparent',
                  borderLeft: currentPage === "staff" ? '4px solid #28a745' : '4px solid transparent',
                  // Added custom hover state using inline style logic for immediate feedback
                  '--bs-nav-link-hover-color': '#28a745',
                  '--bs-dropdown-link-hover-bg': '#f0fff0',
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <Briefcase size={24} style={{ color: '#28a745' }} /> 
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "16px", lineHeight: "1.2", color: '#333' }}>Staff Management</div>
                    <small style={{ fontSize: "12px", color: '#6c757d' }}>Track daily work and manage staff rates.</small>
                  </div>
                </div>
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default NavigationBar;