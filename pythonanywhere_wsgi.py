import sys
path = "/home/ivanpodzharov/stroop-tes"
if path not in sys.path:
    sys.path.append(path)

from wsgi_app import application
