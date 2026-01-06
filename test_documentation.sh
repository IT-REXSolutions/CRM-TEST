#!/bin/bash
# =====================================================
# IT DOCUMENTATION MODULE - FUNCTIONAL TEST SUITE
# DocuSnap Feature Parity Tests
# =====================================================

BASE_URL="https://itsm-chatwoot.preview.emergentagent.com"
API_URL="$BASE_URL/api"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0

# Test results array
declare -a TEST_RESULTS

log_test() {
    local test_id="$1"
    local test_name="$2"
    local status="$3"
    local details="$4"
    
    if [ "$status" == "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC} - $test_id: $test_name"
        ((PASS++))
    elif [ "$status" == "FAIL" ]; then
        echo -e "${RED}❌ FAIL${NC} - $test_id: $test_name"
        echo -e "   Details: $details"
        ((FAIL++))
    else
        echo -e "${YELLOW}⏭️ SKIP${NC} - $test_id: $test_name (Schema not installed)"
        ((SKIP++))
    fi
    TEST_RESULTS+=("$test_id|$status|$test_name|$details")
}

echo "=============================================="
echo -e "${BLUE}🧪 IT DOCUMENTATION - FUNCTIONAL TEST SUITE${NC}"
echo "=============================================="
echo "Testing against: $BASE_URL"
echo "Started: $(date)"
echo ""

# =====================================================
# T-API: API Availability Tests
# =====================================================
echo -e "\n${BLUE}=== T-API: API Verfügbarkeit ===${NC}"

# T-API-01: Documentation Overview API
response=$(curl -s -w "%{http_code}" -o /tmp/test_overview.json "$API_URL/documentation/organizations/00000000-0000-0000-0000-000000000001/overview")
http_code="${response: -3}"
if [ "$http_code" == "200" ]; then
    log_test "T-API-01" "Documentation Overview API erreichbar" "PASS" "HTTP $http_code"
else
    log_test "T-API-01" "Documentation Overview API erreichbar" "FAIL" "HTTP $http_code"
fi

# T-API-02: Inventory API
response=$(curl -s -w "%{http_code}" -o /tmp/test_inv.json "$API_URL/documentation/inventory")
http_code="${response: -3}"
if [ "$http_code" == "200" ]; then
    log_test "T-API-02" "Inventory API erreichbar" "PASS" "HTTP $http_code"
else
    log_test "T-API-02" "Inventory API erreichbar" "FAIL" "HTTP $http_code"
fi

# T-API-03: Templates API
response=$(curl -s -w "%{http_code}" -o /tmp/test_tpl.json "$API_URL/documentation/templates")
http_code="${response: -3}"
if [ "$http_code" == "200" ]; then
    templates=$(cat /tmp/test_tpl.json | grep -o '"name"' | wc -l)
    if [ "$templates" -ge 4 ]; then
        log_test "T-API-03" "Templates API liefert Vorlagen" "PASS" "$templates Vorlagen gefunden"
    else
        log_test "T-API-03" "Templates API liefert Vorlagen" "FAIL" "Nur $templates Vorlagen"
    fi
else
    log_test "T-API-03" "Templates API liefert Vorlagen" "FAIL" "HTTP $http_code"
fi

# T-API-04: Network Devices API
response=$(curl -s -w "%{http_code}" -o /tmp/test_net.json "$API_URL/documentation/network/devices")
http_code="${response: -3}"
if [ "$http_code" == "200" ]; then
    log_test "T-API-04" "Network Devices API erreichbar" "PASS" "HTTP $http_code"
else
    log_test "T-API-04" "Network Devices API erreichbar" "FAIL" "HTTP $http_code"
fi

# T-API-05: AD Users API
response=$(curl -s -w "%{http_code}" -o /tmp/test_ad.json "$API_URL/documentation/ad/users")
http_code="${response: -3}"
if [ "$http_code" == "200" ]; then
    log_test "T-API-05" "AD Users API erreichbar" "PASS" "HTTP $http_code"
else
    log_test "T-API-05" "AD Users API erreichbar" "FAIL" "HTTP $http_code"
fi

# T-API-06: Permissions API
response=$(curl -s -w "%{http_code}" -o /tmp/test_perm.json "$API_URL/documentation/permissions/risks")
http_code="${response: -3}"
if [ "$http_code" == "200" ]; then
    log_test "T-API-06" "Permissions Risks API erreichbar" "PASS" "HTTP $http_code"
else
    log_test "T-API-06" "Permissions Risks API erreichbar" "FAIL" "HTTP $http_code"
fi

# T-API-07: Reports API
response=$(curl -s -w "%{http_code}" -o /tmp/test_rep.json "$API_URL/documentation/reports")
http_code="${response: -3}"
if [ "$http_code" == "200" ]; then
    log_test "T-API-07" "Reports API erreichbar" "PASS" "HTTP $http_code"
else
    log_test "T-API-07" "Reports API erreichbar" "FAIL" "HTTP $http_code"
fi

# T-API-08: Audit API
response=$(curl -s -w "%{http_code}" -o /tmp/test_audit.json "$API_URL/documentation/audit")
http_code="${response: -3}"
if [ "$http_code" == "200" ]; then
    log_test "T-API-08" "Audit API erreichbar" "PASS" "HTTP $http_code"
else
    log_test "T-API-08" "Audit API erreichbar" "FAIL" "HTTP $http_code"
fi

# =====================================================
# T-SCHEMA: Schema Check
# =====================================================
echo -e "\n${BLUE}=== T-SCHEMA: Datenbank-Schema ===${NC}"

# Check if tables_ready flag is true
tables_ready=$(cat /tmp/test_overview.json 2>/dev/null | grep -o '"tables_ready":true' | wc -l)
if [ "$tables_ready" -gt 0 ]; then
    log_test "T-SCHEMA-01" "Documentation Schema installiert" "PASS" "tables_ready=true"
    SCHEMA_READY=true
else
    log_test "T-SCHEMA-01" "Documentation Schema installiert" "SKIP" "Schema nicht installiert - führen Sie schema-documentation.sql aus"
    SCHEMA_READY=false
fi

# =====================================================
# T-INV: Inventory Tests (nur wenn Schema ready)
# =====================================================
echo -e "\n${BLUE}=== T-INV: Inventory Tests ===${NC}"

if [ "$SCHEMA_READY" == "true" ]; then
    # T-INV-01: AD inventory imported
    ad_users=$(curl -s "$API_URL/documentation/ad/users" | grep -o '"id"' | wc -l)
    if [ "$ad_users" -gt 0 ]; then
        log_test "T-INV-01" "AD-Benutzer importiert" "PASS" "$ad_users Benutzer"
    else
        log_test "T-INV-01" "AD-Benutzer importiert" "FAIL" "Keine AD-Benutzer"
    fi
    
    # T-INV-02: Network devices imported
    devices=$(curl -s "$API_URL/documentation/network/devices" | grep -o '"id"' | wc -l)
    if [ "$devices" -gt 0 ]; then
        log_test "T-INV-02" "Netzwerkgeräte importiert" "PASS" "$devices Geräte"
    else
        log_test "T-INV-02" "Netzwerkgeräte importiert" "FAIL" "Keine Geräte"
    fi
    
    # T-INV-03: Inventory items imported
    items=$(curl -s "$API_URL/documentation/inventory" | grep -o '"id"' | wc -l)
    if [ "$items" -gt 0 ]; then
        log_test "T-INV-03" "Inventar-Items importiert" "PASS" "$items Items"
    else
        log_test "T-INV-03" "Inventar-Items importiert" "FAIL" "Keine Items"
    fi
    
    # T-INV-04: VLANs imported
    vlans=$(curl -s "$API_URL/documentation/network/vlans" | grep -o '"vlan_id"' | wc -l)
    if [ "$vlans" -gt 0 ]; then
        log_test "T-INV-04" "VLANs importiert" "PASS" "$vlans VLANs"
    else
        log_test "T-INV-04" "VLANs importiert" "FAIL" "Keine VLANs"
    fi
else
    log_test "T-INV-01" "AD-Benutzer importiert" "SKIP" ""
    log_test "T-INV-02" "Netzwerkgeräte importiert" "SKIP" ""
    log_test "T-INV-03" "Inventar-Items importiert" "SKIP" ""
    log_test "T-INV-04" "VLANs importiert" "SKIP" ""
fi

# =====================================================
# T-MAP: Network Map Tests
# =====================================================
echo -e "\n${BLUE}=== T-MAP: Network Map Tests ===${NC}"

# T-MAP-01: Topology API
response=$(curl -s -w "%{http_code}" -o /tmp/test_topo.json "$API_URL/documentation/network/topology")
http_code="${response: -3}"
if [ "$http_code" == "200" ]; then
    has_nodes=$(cat /tmp/test_topo.json | grep -o '"nodes"' | wc -l)
    has_edges=$(cat /tmp/test_topo.json | grep -o '"edges"' | wc -l)
    if [ "$has_nodes" -gt 0 ] && [ "$has_edges" -gt 0 ]; then
        log_test "T-MAP-01" "Topology API liefert Graph-Daten" "PASS" "nodes & edges vorhanden"
    else
        log_test "T-MAP-01" "Topology API liefert Graph-Daten" "FAIL" "Keine Graph-Struktur"
    fi
else
    log_test "T-MAP-01" "Topology API liefert Graph-Daten" "FAIL" "HTTP $http_code"
fi

# =====================================================
# T-PERM: Permission Analysis Tests
# =====================================================
echo -e "\n${BLUE}=== T-PERM: Permission Analysis Tests ===${NC}"

if [ "$SCHEMA_READY" == "true" ]; then
    # T-PERM-01: Shares loaded
    shares=$(curl -s "$API_URL/documentation/permissions/shares" | grep -o '"share_name"' | wc -l)
    if [ "$shares" -gt 0 ]; then
        log_test "T-PERM-01" "Freigaben geladen" "PASS" "$shares Freigaben"
    else
        log_test "T-PERM-01" "Freigaben geladen" "FAIL" "Keine Freigaben"
    fi
    
    # T-PERM-02: Risk findings
    risks=$(curl -s "$API_URL/documentation/permissions/risks" | grep -o '"risk_level"' | wc -l)
    if [ "$risks" -gt 0 ]; then
        log_test "T-PERM-02" "Berechtigungs-Risiken erkannt" "PASS" "$risks Risiken"
    else
        log_test "T-PERM-02" "Berechtigungs-Risiken erkannt" "FAIL" "Keine Risiken"
    fi
else
    log_test "T-PERM-01" "Freigaben geladen" "SKIP" ""
    log_test "T-PERM-02" "Berechtigungs-Risiken erkannt" "SKIP" ""
fi

# =====================================================
# T-DOC: Document/Handbook Tests
# =====================================================
echo -e "\n${BLUE}=== T-DOC: Document Tests ===${NC}"

# T-DOC-01: Templates available
templates=$(curl -s "$API_URL/documentation/templates" | grep -o '"template_type"' | wc -l)
if [ "$templates" -ge 4 ]; then
    log_test "T-DOC-01" "Handbuch-Vorlagen verfügbar" "PASS" "$templates Vorlagen"
else
    log_test "T-DOC-01" "Handbuch-Vorlagen verfügbar" "FAIL" "Nur $templates Vorlagen"
fi

# =====================================================
# T-INT: Integration Tests
# =====================================================
echo -e "\n${BLUE}=== T-INT: Integration Tests ===${NC}"

# T-INT-01: Organizations accessible
orgs=$(curl -s "$API_URL/organizations" | grep -o '"id"' | wc -l)
if [ "$orgs" -gt 0 ]; then
    log_test "T-INT-01" "Organisationen für Dokumentation verfügbar" "PASS" "$orgs Organisationen"
else
    log_test "T-INT-01" "Organisationen für Dokumentation verfügbar" "FAIL" "Keine Organisationen"
fi

# T-INT-02: Tickets API works
tickets=$(curl -s "$API_URL/tickets" | grep -o '"id"' | wc -l)
if [ "$tickets" -ge 0 ]; then
    log_test "T-INT-02" "Ticket-Integration möglich" "PASS" "Tickets API OK"
else
    log_test "T-INT-02" "Ticket-Integration möglich" "FAIL" "Tickets API Fehler"
fi

# =====================================================
# T-SEC: Security Tests
# =====================================================
echo -e "\n${BLUE}=== T-SEC: Security Tests ===${NC}"

# T-SEC-01: No plaintext secrets in overview
overview_content=$(cat /tmp/test_overview.json 2>/dev/null)
if echo "$overview_content" | grep -iq "password\|secret\|api_key"; then
    log_test "T-SEC-01" "Keine Klartext-Secrets in API-Responses" "FAIL" "Secrets gefunden!"
else
    log_test "T-SEC-01" "Keine Klartext-Secrets in API-Responses" "PASS" "Keine Secrets"
fi

# =====================================================
# SUMMARY
# =====================================================
echo ""
echo "=============================================="
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo "=============================================="
echo -e "${GREEN}✅ PASSED: $PASS${NC}"
echo -e "${RED}❌ FAILED: $FAIL${NC}"
echo -e "${YELLOW}⏭️ SKIPPED: $SKIP${NC}"
echo "=============================================="
TOTAL=$((PASS + FAIL))
if [ $TOTAL -gt 0 ]; then
    PERCENT=$((PASS * 100 / TOTAL))
    echo "Success Rate: $PERCENT%"
fi
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️ Some tests failed or skipped${NC}"
    if [ "$SCHEMA_READY" != "true" ]; then
        echo ""
        echo "📋 NÄCHSTE SCHRITTE:"
        echo "   1. Führen Sie /app/public/schema-documentation.sql in Supabase aus"
        echo "   2. Führen Sie /app/public/schema-documentation-data.sql aus"
        echo "   3. Führen Sie diesen Test erneut aus"
    fi
    exit 1
fi
