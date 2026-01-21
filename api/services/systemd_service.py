"""
Systemd Service
Handles systemctl operations and service management
"""

import subprocess
from typing import Dict
from config_constants import ServiceConfig, APIDefaults


class SystemdService:
    """Service for managing systemd user services"""

    @staticmethod
    def get_service_status(service: str) -> Dict:
        """Get status of a systemd service"""
        try:
            cmd = ['systemctl', '--user', 'is-active', service]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=APIDefaults.SYSTEMCTL_TIMEOUT)
            active = result.stdout.strip() == 'active'

            # Get more details
            cmd = ['systemctl', '--user', 'show', service, '--property=ActiveState,SubState,ExecMainStartTimestamp']
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=APIDefaults.SYSTEMCTL_TIMEOUT)

            details = {}
            for line in result.stdout.strip().split('\n'):
                if '=' in line:
                    key, value = line.split('=', 1)
                    details[key] = value

            return {
                "active": active,
                "state": details.get('ActiveState', 'unknown'),
                "substate": details.get('SubState', 'unknown'),
                "started": details.get('ExecMainStartTimestamp', 'unknown')
            }
        except Exception as e:
            return {
                "active": False,
                "state": "error",
                "error": str(e)
            }

    @staticmethod
    def get_all_services_status() -> Dict:
        """Get status of all configured services"""
        services = {}
        for key, service_file in [('capture', ServiceConfig.CAPTURE_SERVICE),
                                   ('sync_timer', ServiceConfig.SYNC_TIMER),
                                   ('cleanup_timer', ServiceConfig.CLEANUP_TIMER)]:
            status = SystemdService.get_service_status(service_file)
            status['name'] = ServiceConfig.get_display_name(key)
            services[key] = status

        return services

    @staticmethod
    def control_service(action: str, service: str) -> Dict:
        """
        Control a systemd service (start/stop/restart)

        Args:
            action: One of 'start', 'stop', 'restart'
            service: Service key or full service name

        Returns:
            Dict with success status and message
        """
        try:
            # Validate action
            if action not in ['start', 'stop', 'restart']:
                return {
                    "success": False,
                    "error": f"Invalid action: {action}"
                }

            # Get actual service name
            service_name = ServiceConfig.get_service_name(service)

            # Execute systemctl command
            cmd = ['systemctl', '--user', action, service_name]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=APIDefaults.SYSTEMCTL_TIMEOUT)

            if result.returncode == 0:
                return {
                    "success": True,
                    "message": f"Service {service_name} {action}ed successfully",
                    "status": SystemdService.get_service_status(service_name)
                }
            else:
                error_msg = result.stderr.strip() if result.stderr else result.stdout.strip()
                if not error_msg:
                    error_msg = f"Command failed with return code {result.returncode}"

                return {
                    "success": False,
                    "error": error_msg
                }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": f"Command timed out after {APIDefaults.SYSTEMCTL_TIMEOUT} seconds"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    def is_service_active(service: str) -> bool:
        """Quick check if service is active"""
        try:
            service_name = ServiceConfig.get_service_name(service)
            status = SystemdService.get_service_status(service_name)
            return status.get('active', False)
        except:
            return False
