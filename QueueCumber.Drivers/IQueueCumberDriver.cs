using QueueCumber.Models;
using QueueCumber.Models.Entities;

namespace QueueCumber.Drivers
{
    public interface IQueueCumberDriver
    {

        public Enums.Drivers getDriver();
        public bool hasQueues();
        public bool hasStreams();
        public bool isConnected();
        public Guid getSessionId();
        public void Disconnect();


        public static abstract IQueueCumberDriver Connect(QueueCumberConnection connection);


    }
}
