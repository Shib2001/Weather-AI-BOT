class WeatherError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status
