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

clientKey = config.clientKey
screenPath = config.screenPath
serverUrl = config.serverUrl

clientToken = ''
screenList = []

logging.getLogger("requests").setLevel(logging.WARNING)

def getToken():
	global clientToken
	payload = {'userid': clientKey}
	r = requests.post(serverUrl + "/api/auth", json=payload)
	response = r.json()
	if(response['success'] == True):
		clientToken = response['token']

def getScreenshotList():
	global clientToken
	global screenList
	if clientToken == '':
		getToken()
	headers = {'x-access-token': clientToken}
	r = requests.get(serverUrl + "/api/screenshots", headers=headers)
	screenList = r.json()
	logging.info("Refreshed screenList")

def postScreenshot(screenPath):
	files = {'screenFile': open(screenPath, 'rb')}
	if clientToken == '':
		getToken()
	headers = {'x-access-token': clientToken}
	r = requests.post(serverUrl + "/api/upload", files=files, headers=headers)
	response = r.json()
	if(response['success'] == True):
		logging.info("Uploaded file: %s", screenPath)
		logging.info("Image URL: %s", serverUrl + urllib.parse.quote(response['url']))
		spam = pyperclip.copy(serverUrl + urllib.parse.quote(response['url']))
		logging.info("Copied URL to clipboard!")
		getScreenshotList()

class CloudHandler(LoggingEventHandler):
	def __init__(self):
		super(CloudHandler, self).__init__()

	# This function gets called every time a new screenshot is moved
	# from it's temporary path to the final destination
	def on_moved(self, event):
		super(LoggingEventHandler, self).on_moved(event)
		postScreenshot(event.dest_path)

	def on_created(self, event):
		super(LoggingEventHandler, self).on_created(event)

	def on_deleted(self, event):
		super(LoggingEventHandler, self).on_deleted(event)

	def on_modified(self, event):
		super(LoggingEventHandler, self).on_modified(event)


if __name__ == "__main__":
	getToken()
	logging.basicConfig(level=logging.INFO,
						format='%(asctime)s - %(message)s',
						datefmt='%Y-%m-%d %H:%M:%S')
	event_handler = CloudHandler()
	observer = Observer()
	observer.schedule(event_handler, screenPath, recursive=True)
	observer.start()
	getScreenshotList()
	interval = 60 #seconds
	interval = interval * 2
	counter = 0
	try:
		while True:
			if counter == interval:
				getScreenshotList()
				counter = 0
			counter += 1
			time.sleep(0.5)
	except KeyboardInterrupt:
		observer.stop()
	observer.join()

