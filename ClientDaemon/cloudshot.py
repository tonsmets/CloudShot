import sys
import time
import logging
import requests
import json
import urllib.parse
import pyperclip
from watchdog.observers import Observer
from watchdog.events import LoggingEventHandler
import config
import threading
from os import listdir
from os.path import isfile, join

clientKey = config.clientKey
screenPath = config.screenPath
serverUrl = config.serverUrl

clientToken = ''
serverScreens = []
localScreens = []

waitingForUpload = []

logging.getLogger("requests").setLevel(logging.WARNING)

def getToken():
	global clientToken

	try:
		payload = {'userid': clientKey}
		r = requests.post(serverUrl + "/api/auth", json=payload)
		response = r.json()
		if(response['success'] == True):
			clientToken = response['token']
	except:
		logging.info("Unable to retrieve token from server")
		pass

def getScreenshotList():
	global clientToken
	global serverScreens
	if clientToken == '':
		getToken()

	try:
		headers = {'x-access-token': clientToken}
		r = requests.get(serverUrl + "/api/screenshots", headers=headers)
		response = r.json()

		if response['success'] == True:
			serverScreens = response['data']
			logging.info("Refreshed serverScreens")
		else:
			getToken()
			getScreenshotList()
	except:
		logging.info("Unable to retrieve screenshot list from server")
		pass

def postScreenshot(screenPath):
	files = {'screenFile': open(screenPath, 'rb')}
	if clientToken == '':
		getToken()
	try:
		headers = {'x-access-token': clientToken}
		r = requests.post(serverUrl + "/api/upload", files=files, headers=headers)
		response = r.json()
		if response['success'] == True:
			logging.info("Uploaded file: %s", screenPath)
			logging.info("Image URL: %s", serverUrl + urllib.parse.quote(response['url']))
			spam = pyperclip.copy(serverUrl + urllib.parse.quote(response['url']))
			logging.info("Copied URL to clipboard!")
			getScreenshotList()
		else:
			getToken()
			postScreenshot(screenPath)
	except:
		logging.info("Unable to upload screenshot to server")
		pass

def checkScreenFolder():
	global serverScreens
	global localScreens

	missingScreens = []

	if serverScreens == []:
		getScreenshotList()
	localScreens = [ f for f in listdir(screenPath) if isfile(join(screenPath,f)) ]
	
	matchFound = False
	for x in range(0, len(localScreens)):
		for y in range(0, len(serverScreens)):
			if localScreens[x] == serverScreens[y]['filename']:
				matchFound = True
		if(matchFound == False):
			if(localScreens[x] != '.DS_Store'):
				missingScreens.append(localScreens[x])
		matchFound = False

	for z in range(0, len(missingScreens)):
		postScreenshot(screenPath + "/" + missingScreens[z])
				


class CloudHandler(LoggingEventHandler):
	def __init__(self):
		super(CloudHandler, self).__init__()

	# This function gets called every time a new screenshot is moved
	# from it's temporary path to the final destination
	def on_moved(self, event):
		super(LoggingEventHandler, self).on_moved(event)
		# Execute the uploading on a seperate thread to keep the events coming in
		#t = threading.Thread(target=postScreenshot,name="Upload screenshot",args=(event.dest_path,))
		#t.daemon = True
		#t.start()
		checkScreenFolder()

	def on_created(self, event):
		super(LoggingEventHandler, self).on_created(event)
		checkScreenFolder()

	def on_deleted(self, event):
		super(LoggingEventHandler, self).on_deleted(event)
		checkScreenFolder()

	def on_modified(self, event):
		super(LoggingEventHandler, self).on_modified(event)
		checkScreenFolder()


def runMain():
	getToken()
	logging.basicConfig(level=logging.INFO,
						format='%(asctime)s - %(message)s',
						datefmt='%Y-%m-%d %H:%M:%S')
	event_handler = CloudHandler()
	observer = Observer()
	observer.schedule(event_handler, screenPath, recursive=False)
	observer.start()
	getScreenshotList()
	checkScreenFolder()
	interval = 60 #seconds
	interval = interval * 1
	counter = 0
	try:
		while True:
			if counter == interval:
				getScreenshotList()
				checkScreenFolder()
				counter = 0
			counter += 1
			time.sleep(1)
	except KeyboardInterrupt:
		observer.stop()
	observer.join()

if __name__ == '__main__':
	runMain()

