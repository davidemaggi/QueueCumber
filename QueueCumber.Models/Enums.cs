namespace QueueCumber.Models
{
    public class Enums
    {


        public enum Drivers
        {
            RabbitMQ,
            ApacheKafka
        }

        public enum AuthType
        {
            NoAuth,
            Raw,
            Basic,
            Certificate
        }

        public enum ConnectionStatus
        {
            Disconnected,
            Connected,

        }

        public enum ConnectionConfigType
        {
            Basic,
            Advanced,

        }

        public enum QueueType
        {
            Queue,
            Stream,

        }


    }
}
