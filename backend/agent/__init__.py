# agent/__init__.py
from . import agent 

# It's also good practice to directly expose the root_agent 
# variable at the package level for clarity and potential future use.
from .agent import root_agent