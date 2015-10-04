from daemon import Daemon
import cloudshot

class cloudShotDaemon(Daemon):
	def run(self):
		cloudshot.runMain()

CloudShot = cloudShotDaemon('/usr/local/cloudshot.pid')
CloudShot.start()