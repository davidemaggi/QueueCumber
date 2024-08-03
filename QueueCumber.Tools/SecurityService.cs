namespace QueueCumber.Tools
{
    public class SecurityService
    {

        private readonly string _userSecret = "QueueCumberUserSecret";


        public string GetUserSecret()
        {


            {
                // Get the value of the environment variable
                string value = Environment.GetEnvironmentVariable(_userSecret, EnvironmentVariableTarget.User);

                // Check if the variable exists
                if (value != null)
                {
                    // Return the existing value
                    return value;
                }
                else
                {
                    // Create a new GUID
                    string newGuidValue = Guid.NewGuid().ToString();

                    // Set the new value for the environment variable
                    Environment.SetEnvironmentVariable(_userSecret, newGuidValue, EnvironmentVariableTarget.User);

                    // Return the new value
                    return newGuidValue;
                }
            }





        }


    }
}
