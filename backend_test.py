import requests
import sys
import json
from datetime import datetime, timedelta

class DashboardAPITester:
    def __init__(self, base_url="https://presupuesto-app-27.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.created_budget_id = None
        self.created_event_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        success, response = self.run_test("Dashboard Stats", "GET", "dashboard/stats", 200)
        if success:
            required_fields = ["total_budgets", "pending_budgets", "approved_budgets", 
                             "rejected_budgets", "total_approved_amount", "upcoming_events"]
            for field in required_fields:
                if field not in response:
                    print(f"❌ Missing field in stats: {field}")
                    return False
            print("✅ All required stats fields present")
        return success

    def test_budget_crud(self):
        """Test complete Budget CRUD operations"""
        print("\n=== TESTING BUDGET CRUD ===")
        
        # 1. Get all budgets (should work even if empty)
        success, budgets = self.run_test("Get All Budgets", "GET", "budgets", 200)
        if not success:
            return False
        
        # 2. Create a new budget
        budget_data = {
            "title": "Proyecto Web",
            "client_name": "Cliente Test",
            "amount": 5000.0,
            "description": "Test budget for API testing",
            "status": "pending"
        }
        success, created_budget = self.run_test("Create Budget", "POST", "budgets", 200, budget_data)
        if not success:
            return False
        
        self.created_budget_id = created_budget.get("id")
        if not self.created_budget_id:
            print("❌ No ID returned from budget creation")
            return False
        
        # 3. Get the created budget by ID
        success, _ = self.run_test("Get Budget by ID", "GET", f"budgets/{self.created_budget_id}", 200)
        if not success:
            return False
        
        # 4. Update the budget status
        update_data = {"status": "approved"}
        success, _ = self.run_test("Update Budget", "PUT", f"budgets/{self.created_budget_id}", 200, update_data)
        if not success:
            return False
        
        # 5. Get budgets by status filter
        success, _ = self.run_test("Get Budgets by Status", "GET", "budgets", 200, params={"status": "approved"})
        if not success:
            return False
        
        # 6. Delete the budget (will be done at cleanup)
        return True

    def test_event_crud(self):
        """Test complete Event CRUD operations"""
        print("\n=== TESTING EVENT CRUD ===")
        
        # 1. Get all events (should work even if empty)
        success, events = self.run_test("Get All Events", "GET", "events", 200)
        if not success:
            return False
        
        # 2. Create a new event
        today = datetime.now().strftime("%Y-%m-%d")
        event_data = {
            "title": "Reunión",
            "date": today,
            "start_time": "10:00",
            "end_time": "11:00",
            "description": "Test event for API testing"
        }
        success, created_event = self.run_test("Create Event", "POST", "events", 200, event_data)
        if not success:
            return False
        
        self.created_event_id = created_event.get("id")
        if not self.created_event_id:
            print("❌ No ID returned from event creation")
            return False
        
        # 3. Get the created event by ID
        success, _ = self.run_test("Get Event by ID", "GET", f"events/{self.created_event_id}", 200)
        if not success:
            return False
        
        # 4. Update the event
        update_data = {"title": "Reunión Actualizada", "end_time": "12:00"}
        success, _ = self.run_test("Update Event", "PUT", f"events/{self.created_event_id}", 200, update_data)
        if not success:
            return False
        
        # 5. Get events by date filter
        success, _ = self.run_test("Get Events by Date", "GET", "events", 200, params={"date": today})
        if not success:
            return False
        
        # 6. Get events by month filter
        month = today[:7]  # YYYY-MM format
        success, _ = self.run_test("Get Events by Month", "GET", "events", 200, params={"month": month})
        if not success:
            return False
        
        return True

    def test_error_cases(self):
        """Test error handling"""
        print("\n=== TESTING ERROR CASES ===")
        
        # Test getting non-existent budget
        success, _ = self.run_test("Get Non-existent Budget", "GET", "budgets/non-existent-id", 404)
        if not success:
            return False
        
        # Test getting non-existent event
        success, _ = self.run_test("Get Non-existent Event", "GET", "events/non-existent-id", 404)
        if not success:
            return False
        
        # Test updating non-existent budget
        success, _ = self.run_test("Update Non-existent Budget", "PUT", "budgets/non-existent-id", 404, {"title": "test"})
        if not success:
            return False
        
        # Test deleting non-existent budget
        success, _ = self.run_test("Delete Non-existent Budget", "DELETE", "budgets/non-existent-id", 404)
        if not success:
            return False
        
        return True

    def cleanup(self):
        """Clean up created test data"""
        print("\n=== CLEANUP ===")
        
        if self.created_budget_id:
            self.run_test("Delete Test Budget", "DELETE", f"budgets/{self.created_budget_id}", 200)
        
        if self.created_event_id:
            self.run_test("Delete Test Event", "DELETE", f"events/{self.created_event_id}", 200)

    def run_all_tests(self):
        """Run all API tests"""
        print(f"🚀 Starting API tests for {self.base_url}")
        
        # Test basic connectivity
        if not self.test_root_endpoint():
            print("❌ Root endpoint failed, stopping tests")
            return False
        
        # Test dashboard stats
        if not self.test_dashboard_stats():
            print("❌ Dashboard stats failed")
            return False
        
        # Test Budget CRUD
        if not self.test_budget_crud():
            print("❌ Budget CRUD failed")
            return False
        
        # Test Event CRUD
        if not self.test_event_crud():
            print("❌ Event CRUD failed")
            return False
        
        # Test error cases
        if not self.test_error_cases():
            print("❌ Error handling tests failed")
            return False
        
        # Cleanup
        self.cleanup()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print(f"\n📊 TEST SUMMARY")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  - {test}")

def main():
    tester = DashboardAPITester()
    
    success = tester.run_all_tests()
    tester.print_summary()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())